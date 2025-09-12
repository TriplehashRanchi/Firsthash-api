// routes/leadRoutes.js
const express = require('express');
const router = express.Router();
const { createLead, getAllLeads, updateStatus } = require('../controllers/leadController');

router.post('/leads/embed', createLead);

router.get('/leads/:admin_id', getAllLeads);

router.patch('/leads/:leadId/status', updateStatus);

module.exports = router;