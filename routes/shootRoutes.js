// File: routes/shootRoutes.js
const express = require('express');
const router = express.Router();
const { updateAssignments } = require('../controllers/shootController');
const { verifyToken, requireAdminWithActiveCompany, requireAdminOrManagerWithActiveCompany } = require('../middleware/auth');

// @route   PUT /api/shoots/:shootId/assignments
// @desc    Update the assignments for a specific service within a shoot
// @access  Private
router.put('/:shootId/assignments', verifyToken, requireAdminOrManagerWithActiveCompany, updateAssignments);

module.exports = router;