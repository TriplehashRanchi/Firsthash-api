const express = require('express');
const router = express.Router();
const {
  verifyWebhook,
  receiveWebhook,
} = require('../controllers/fbWebhookController');

router.get('/', verifyWebhook);
router.post('/', receiveWebhook);

module.exports = router;
