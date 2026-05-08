const razorpay = require('../config/razorpay');
const crypto = require('crypto');
const { updateCompanyAfterPayment, activateAdmin } = require('../models/subscribeModel');
const { getAdminByUID } = require('../models/userModel');
const { getCompanyByOwnerUid } = require('../models/companyModel');
const { sendWhatsAppAccountActivated } = require('../utils/sendAiSensyMessage');
const { logTransaction, updateTransactionStatus  } = require('../models/transactionModel');
const { getPlanByName } = require('../models/planModel');
const { validateCouponCode } = require('../models/couponModel');

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;

const createOrder = async (req, res) => {
  try {
    const { firebase_uid, plan, coupon, gst_number } = req.body;

    if (!firebase_uid || !plan) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const planData = await getPlanByName(plan);
    if (!planData || !planData.is_active) {
      return res.status(400).json({ error: 'Invalid or inactive plan' });
    }

    let finalAmount = planData.price;
    let couponUsed = null;

    if (coupon) {
      const couponData = await validateCouponCode(coupon, planData.id);
      if (!couponData.valid) {
        return res.status(400).json({ error: 'Invalid or expired coupon' });
      }

      couponUsed = coupon;
      if (couponData.discount_type === 'flat') {
        finalAmount -= couponData.discount_value;
      } else if (couponData.discount_type === 'percent') {
        finalAmount -= Math.floor((finalAmount * couponData.discount_value) / 100);
      }
      finalAmount = Math.max(finalAmount, 0);
    }

    // If final amount is 0, activate subscription directly
    if (finalAmount <= 0) {
      const durationDays = planData.duration_days;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + durationDays);

      await updateCompanyAfterPayment({
        firebase_uid,
        plan,
        expiry: expiryDate,
        payment_id: `free_${Date.now()}`, // Use a unique identifier for free checkouts
      });

      await activateAdmin(firebase_uid);
      
      const transactionId = `order_free_${Date.now()}`;
      await logTransaction({
        txn_id: transactionId,
        admin_id: firebase_uid,
        amount: 0,
        description: `Plan: ${plan}${couponUsed ? ` | Coupon: ${couponUsed}` : ''}`,
        status: 'success',
      });
      await updateTransactionStatus(transactionId, 'success', `free_${Date.now()}`);


      // Optional: Send WhatsApp notification
      const admin = await getAdminByUID(firebase_uid);
      const company = await getCompanyByOwnerUid(firebase_uid);
      if (admin && company && admin.phone) {
        await sendWhatsAppAccountActivated({
          name: admin.name || 'there',
          phone: admin.phone,
          company_name: company.name || 'your studio',
        });
      }

      return res.status(200).json({ free_checkout: true, message: 'Subscription activated successfully' });
    }

    if (!GSTIN_PATTERN.test((gst_number || '').trim())) {
      return res.status(400).json({ error: 'Valid GSTIN is required for this plan' });
    }

    // ✅ Create Razorpay Order if amount > 0
    const order = await razorpay.orders.create({
      amount: finalAmount,
      currency: 'INR',
      receipt: `order_${Date.now()}`,
      payment_capture: 1,
    });

    await logTransaction({
      txn_id: order.id,
      admin_id: firebase_uid,
      amount: finalAmount,
      description: `Plan: ${plan}${couponUsed ? ` | Coupon: ${couponUsed}` : ''}`,
      status: 'pending',
    });

    return res.status(201).json({
      order_id: order.id,
      amount: order.amount,
      razorpay_key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('❌ Order creation failed:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

const verifyPayment = async (req, res) => {
  let razorpay_order_id;
  try {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id,
      razorpay_signature,
      firebase_uid,
      plan,
    } = req.body;
    razorpay_order_id = orderId;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const planData = await getPlanByName(plan);
    if (!planData || !planData.is_active) {
      return res.status(400).json({ error: 'Invalid or inactive plan' });
    }

    const durationDays = planData.duration_days;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + durationDays);

    await updateCompanyAfterPayment({
      firebase_uid,
      plan,
      expiry: expiryDate,
      payment_id: razorpay_payment_id,
    });

    await activateAdmin(firebase_uid);

     // ✅ Fetch admin + company info for WhatsApp
    const admin = await getAdminByUID(firebase_uid);
    const company = await getCompanyByOwnerUid(firebase_uid);
    await updateTransactionStatus(razorpay_order_id, 'success', razorpay_payment_id);

    if (admin && company && admin.phone) {
      await sendWhatsAppAccountActivated({
        name: admin.name || 'there',
        phone: admin.phone,
        company_name: company.name || 'your studio',
      });
    }

    res.status(200).json({ message: 'Payment verified and subscription activated.' });
  } catch (error) {
    if (razorpay_order_id) {
      await updateTransactionStatus(razorpay_order_id, 'failed');
    }
    console.error('Payment verification failed:', error);
    res.status(500).json({ error: 'Payment verification failed' });
   
  }
};

module.exports = { createOrder, verifyPayment };
