// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { register, registerWithGoogle, getUserRole } = require('../controllers/authController');


router.get('/user-role/:firebase_uid', getUserRole);

router.post('/register', register);
router.post('/register-google', registerWithGoogle);



module.exports = router;
