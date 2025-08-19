// backend/routes/selfRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

const {
  getMyProfile,
  getMyPaymentDetails,
  updateMyProfile,
  updateMyPaymentDetails,
} = require('../controllers/selfController');

router.use(verifyToken);

router.get('/profile', getMyProfile);
router.get('/payment-details', getMyPaymentDetails);

router.put('/profile', updateMyProfile);
router.put('/payment-details', updateMyPaymentDetails);

module.exports = router;
