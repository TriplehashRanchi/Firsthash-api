const razorpay = require('../config/razorpay');
const crypto = require('crypto');
const { updateCompanyAfterPayment, activateAdmin } = require('../models/subscribeModel');
const { getAdminByUID } = require('../models/userModel');
const { getCompanyByOwnerUid } = require('../models/companyModel');
const { sendWhatsAppAccountActivated } = require('../utils/sendAiSensyMessage');
const { logTransaction, updateTransactionStatus  } = require('../models/transactionModel');

const planPricing = {
  monthly: 49900, // in paise (₹499)
  yearly: 499900, // in paise (₹4999)
};

const createOrder = async (req, res) => {
  try {
    const { firebase_uid, plan, coupon } = req.body;

    if (!firebase_uid || !plan || !planPricing[plan]) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const amount = planPricing[plan];

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `order_${Date.now()}`,
      payment_capture: 1,
    });

    console.log('Created Order:', order); // ✅ Add this

    // after order creation
    await logTransaction({
      txn_id: order.id,
      admin_id: firebase_uid,
      amount,
      description: `Subscription Plan: ${plan}`,
      status: 'pending',
    });

    return res.status(201).json({
      order_id: order.id,
      amount: order.amount,
      razorpay_key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('❌ Razorpay order creation failed:', err); // ✅ Add this
    res.status(500).json({ error: 'Failed to create order' });
  }
};


const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      firebase_uid,
      plan,
    } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const durationDays = plan === 'monthly' ? 30 : 365;
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
     await updateTransactionStatus(razorpay_order_id, 'failed');
    console.error('Payment verification failed:', error);
    res.status(500).json({ error: 'Payment verification failed' });
   
  }
};

module.exports = { createOrder, verifyPayment };
