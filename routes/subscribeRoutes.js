const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment } = require('../controllers/subscribeController');

router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);

module.exports = router;
