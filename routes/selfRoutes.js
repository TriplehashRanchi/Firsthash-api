// backend/routes/selfRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken, requireEmployeeOrManagerWithActiveCompany } = require('../middleware/auth');

const {
  getMyProfile,
  getMyPaymentDetails,
  updateMyProfile,
  updateMyPaymentDetails,
  getMyAttendance,
  getMyLocationCheck,
  markMyAttendanceManually
} = require('../controllers/selfController');

// --- Apply middleware individually ---
router.use(verifyToken);

// Routes for profile and payment details might need the user object set by verifyToken
router.get('/profile', getMyProfile);
router.get('/payment-details', getMyPaymentDetails);
router.put('/profile', updateMyProfile);
router.put('/payment-details', updateMyPaymentDetails);

// Attendance routes use req.firebase_uid from verifyToken.
router.get('/attendance', getMyAttendance);
router.get('/location-check', requireEmployeeOrManagerWithActiveCompany, getMyLocationCheck);
router.post('/attendance/manual', requireEmployeeOrManagerWithActiveCompany, markMyAttendanceManually);


module.exports = router;
