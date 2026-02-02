const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/fbAuthController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.get('/facebook/init', verifyToken, AuthController.facebookInit);
router.get('/facebook', verifyToken, AuthController.facebookLogin);
router.get('/facebook/callback', AuthController.facebookCallback);

module.exports = router;
