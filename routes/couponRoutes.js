// routes/couponRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllCoupons,
  validateCoupon,
  getCoupon,
  postCoupon,
  putCoupon,
  removeCoupon,
} = require('../controllers/couponController');
const verifySuperAdminJWT = require('../middleware/verifySuperAdminJWT');

router
  .get('/', verifySuperAdminJWT, getAllCoupons)   // list
  .get('/:code', validateCoupon)                  // public validate
  .get('/id/:id', verifySuperAdminJWT, getCoupon) // fetch one
  .post('/', verifySuperAdminJWT, postCoupon)
  .put('/:id', verifySuperAdminJWT, putCoupon)
  .delete('/:id', verifySuperAdminJWT, removeCoupon);


module.exports = router;
