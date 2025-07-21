const {
  getCouponByCode,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} = require('../models/couponModel');

const getAllCoupons = async (req, res) => {
  try {
    const coupons = await getAllCoupons();
    res.json(coupons);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
};

const validateCoupon = async (req, res) => {
  try {
    const code = req.params.code;
    const planId = req.query.plan_id; // from query string (optional)

    const coupon = await getCouponByCode(code);
    if (!coupon) {
      return res.status(404).json({ error: 'Invalid or expired coupon' });
    }

    // ❗Check plan_id match only if coupon has a plan attached
    if (coupon.plan_id && coupon.plan_id.toString() !== planId) {
      return res.status(400).json({ error: 'Coupon not valid for this plan' });
    }

    res.json(coupon);
  } catch (err) {
    console.error('Coupon validation error:', err);
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
  getAllCoupons,
  postCoupon,
  putCoupon,
  removeCoupon,
};
