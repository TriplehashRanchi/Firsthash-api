// File: routes/shootRoutes.js
const express = require('express');
const router = express.Router();
const { updateAssignments } = require('../controllers/shootController');
const { updateShootCity } = require('../models/projectModel');
const { verifyToken, requireAdminWithActiveCompany, requireAdminOrManagerWithActiveCompany } = require('../middleware/auth');

// @route   PUT /api/shoots/:shootId/assignments
// @desc    Update the assignments for a specific service within a shoot
// @access  Private
router.put('/:shootId/assignments', verifyToken, requireAdminOrManagerWithActiveCompany, updateAssignments);
router.patch(
  '/:shootId/city',
  verifyToken, requireAdminOrManagerWithActiveCompany,
  async (req, res) => {
    try {
      const shootId = req.params.shootId;
      const { city } = req.body;
      const companyId = req.company.id;

      const result = await updateShootCity(shootId, companyId, city);
      res.json(result);
    } catch (err) {
      console.error('PATCH /api/shoots/:shootId/city error:', err);
      res.status(400).json({ error: err.message });
    }
  }
);


module.exports = router;