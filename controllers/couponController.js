// controllers/couponController.js

const {
  getCouponByCode,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getAllCoupons: fetchAllCoupons,   // alias the model fn
} = require('../models/couponModel');

// ✅ SuperAdmin only: list all coupons
const getAllCoupons = async (req, res) => {
  try {
    const coupons = await fetchAllCoupons();   // now calls the model, not itself
    res.json(coupons);
  } catch (err) {
    console.error('Error fetching coupons:', err);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
};

// 🔓 Public: validate by code (and optional plan_id query)
const validateCoupon = async (req, res) => {
  try {
    const code = req.params.code;
    const planId = req.query.plan_id;

    const coupon = await getCouponByCode(code);
    if (!coupon) {
      return res.status(404).json({ error: 'Invalid or expired coupon' });
    }
    if (coupon.plan_id && coupon.plan_id.toString() !== planId) {
      return res.status(400).json({ error: 'Coupon not valid for this plan' });
    }
    res.json(coupon);
  } catch (err) {
    console.error('Coupon validation error:', err);
    res.status(500).json({ error: 'Coupon validation failed' });
  }
};

// 🔒 SuperAdmin only: get one by ID
const getCoupon = async (req, res) => {
  try {
    const coupon = await getCouponById(req.params.id);
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    res.json(coupon);
  } catch (err) {
    console.error('Fetch coupon error:', err);
    res.status(500).json({ error: 'Failed to fetch coupon' });
  }
};

// 🔒 SuperAdmin only: create
const postCoupon = async (req, res) => {
  try {
    await createCoupon(req.body);
    res.status(201).json({ message: 'Coupon created' });
  } catch (err) {
    console.error('Create coupon error:', err);
    res.status(500).json({ error: 'Failed to create coupon' });
  }
};

// 🔒 SuperAdmin only: update
const putCoupon = async (req, res) => {
  try {
    await updateCoupon(req.params.id, req.body);
    res.json({ message: 'Coupon updated' });
  } catch (err) {
    console.error('Update coupon error:', err);
    res.status(500).json({ error: 'Failed to update coupon' });
  }
};

// 🔒 SuperAdmin only: deactivate
const removeCoupon = async (req, res) => {
  try {
    await deleteCoupon(req.params.id);
    res.json({ message: 'Coupon deactivated' });
  } catch (err) {
    console.error('Delete coupon error:', err);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
};

module.exports = {
  getAllCoupons,
  validateCoupon,
  getCoupon,
  postCoupon,
  putCoupon,
  removeCoupon,
};
