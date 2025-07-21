const express = require('express');
const router = express.Router();
const {
  validateCoupon,
  getCoupon,
  postCoupon,
  putCoupon,
  removeCoupon,
} = require('../controllers/couponController');

router.get('/:code', validateCoupon);          // Validate via code
router.get('/id/:id', getCoupon);              // Get by DB ID
router.post('/', postCoupon);
router.put('/:id', putCoupon);
router.delete('/:id', removeCoupon);

module.exports = router;
