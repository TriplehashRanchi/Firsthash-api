const express = require('express');
const router = express.Router();

const {
  validateCoupon,
  getCoupon,
  postCoupon,
  putCoupon,
  removeCoupon,
} = require('../controllers/couponController');

const verifySuperAdminJWT = require('../middleware/verifySuperAdminJWT');

// ✅ Public: For users validating coupons at checkout
router.get('/:code', validateCoupon);

// 🔒 Protected: Super Admin access only
router.get('/id/:id', verifySuperAdminJWT, getCoupon);
router.post('/', verifySuperAdminJWT, postCoupon);
router.put('/:id', verifySuperAdminJWT, putCoupon);
router.delete('/:id', verifySuperAdminJWT, removeCoupon);

module.exports = router;
