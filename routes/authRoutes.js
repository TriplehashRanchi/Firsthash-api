// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { register, registerWithGoogle, getUserRole } = require('../controllers/authController');
const { verifyOtp } = require('../controllers/otpController');


router.get('/user-role/:firebase_uid', getUserRole);

router.post('/register', register);
router.post('/register-google', registerWithGoogle);

// new OTP verify route
router.post('/otp/verify', verifyOtp);



module.exports = router;
