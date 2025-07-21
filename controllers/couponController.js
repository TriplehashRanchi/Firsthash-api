const {
  getCouponByCode,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} = require('../models/couponModel');

const validateCoupon = async (req, res) => {
  try {
    const coupon = await getCouponByCode(req.params.code);
    if (!coupon) return res.status(404).json({ error: 'Invalid or expired coupon' });
    res.json(coupon);
  } catch (err) {
    res.status(500).json({ error: 'Coupon validation failed' });
  }
};

const getCoupon = async (req, res) => {
  try {
    const coupon = await getCouponById(req.params.id);
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    res.json(coupon);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch coupon' });
  }
};

const postCoupon = async (req, res) => {
  try {
    await createCoupon(req.body);
    res.status(201).json({ message: 'Coupon created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create coupon' });
  }
};

const putCoupon = async (req, res) => {
  try {
    await updateCoupon(req.params.id, req.body);
    res.json({ message: 'Coupon updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update coupon' });
  }
};

const removeCoupon = async (req, res) => {
  try {
    await deleteCoupon(req.params.id);
    res.json({ message: 'Coupon deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
};

module.exports = {
  validateCoupon,
  getCoupon,
  postCoupon,
  putCoupon,
  removeCoupon,
};
