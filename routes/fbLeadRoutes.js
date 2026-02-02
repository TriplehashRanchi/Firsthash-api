const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { pollFacebookLeads } = require('../controllers/fbLeadsController');

router.post('/poll', verifyToken, requireAdmin, pollFacebookLeads);

module.exports = router;
