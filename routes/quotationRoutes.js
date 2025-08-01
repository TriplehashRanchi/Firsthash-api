// File: routes/quotationRoutes.js

const express = require('express');
// mergeParams is crucial for nested routes like /projects/:projectId/quotations
const router = express.Router({ mergeParams: true }); 
const { generateQuotation } = require('../controllers/quotationController');
const { verifyToken, requireAdminWithActiveCompany } = require('../middleware/auth');

// @route   POST /api/projects/:projectId/quotations
// @desc    Generate a new quotation PDF for a specific project
// @access  Private
router.post('/', verifyToken, requireAdminWithActiveCompany, generateQuotation);

// You could add other routes here later, e.g., to GET all quotations for a project
// router.get('/', protect, getProjectQuotations);

module.exports = router;