const express = require('express');
const router = express.Router();
const { getAdminProfile, updateAdminProfile } = require('../controllers/adminController');

// Import your existing authentication middleware from `middleware/auth.js`
const { verifyToken } = require('../middleware/auth'); 

// Apply the `verifyToken` middleware to ALL routes defined in this file.
// This ensures that only a logged-in user can access their profile information.
router.use(verifyToken);

// --- Define the Profile Routes ---

// @route   GET /api/admins/profile
// @desc    Get the profile of the currently logged-in admin
// @access  Private (due to the `verifyToken` middleware above)
router.get('/profile', getAdminProfile);

// @route   PUT /api/admins/profile
// @desc    Update the profile of the currently logged-in admin
// @access  Private (due to the `verifyToken` middleware above)
router.put('/profile', updateAdminProfile);

module.exports = router;