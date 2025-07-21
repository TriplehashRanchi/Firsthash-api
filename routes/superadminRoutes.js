const express = require('express');
const router = express.Router();
const { superAdminLogin } = require('../controllers/superadminController');
const verifySuperAdminJWT = require('../middleware/verifySuperAdminJWT');

// Login route
router.post('/login', superAdminLogin);

// Example protected route
router.get('/check', verifySuperAdminJWT, (req, res) => {
  res.json({ message: 'Super Admin verified', user: req.superAdmin });
});

module.exports = router;
