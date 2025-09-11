// routes/leadRoutes.js
const express = require('express');
const router = express.Router();
const { createLead, getAllLeads } = require('../controllers/leadController');

router.post('/leads/embed', createLead);

router.get('/leads/:admin_id', getAllLeads);

module.exports = router;