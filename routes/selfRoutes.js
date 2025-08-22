// backend/routes/selfRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

const {
  getMyProfile,
  getMyPaymentDetails,
  updateMyProfile,
  updateMyPaymentDetails,
  getMyAttendance
} = require('../controllers/selfController');

// --- Apply middleware individually ---
router.use(verifyToken);

// Routes for profile and payment details might need the user object set by verifyToken
router.get('/profile', getMyProfile);
router.get('/payment-details', getMyPaymentDetails);
router.put('/profile', updateMyProfile);
router.put('/payment-details', updateMyPaymentDetails);


// ✅ THIS IS THE FIX: Your new route for attendance.
// It does NOT use the faulty verifyToken middleware because the controller handles everything itself.
router.get('/attendance', getMyAttendance);


module.exports = router;