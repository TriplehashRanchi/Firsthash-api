const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const db = require('../config/db');
const { verifyToken } = require('../middleware/auth');

// ✅ Fix: simplified + correct columns
const attachUserContext = async (req, res, next) => {
  try {
    const firebase_uid = req.firebase_uid || req.user?.firebase_uid;

    if (!firebase_uid) {
      return res.status(401).json({ error: 'Firebase UID missing.' });
    }

    // Check if user is admin or employee
    const [adminRows] = await db.query(
      `SELECT firebase_uid, name, company_id FROM admins WHERE firebase_uid = ?`,
      [firebase_uid]
    );

    const [employeeRows] = await db.query(
      `SELECT firebase_uid, name, company_id FROM employees WHERE firebase_uid = ?`,
      [firebase_uid]
    );

    const user = adminRows[0] || employeeRows[0];

    if (!user) {
      return res.status(403).json({ error: 'User not found or unauthorized.' });
    }

    // Attach basic info for downstream routes
    req.role = adminRows.length > 0 ? 'admin' : 'employee';
    req.firebase_uid = firebase_uid;
    req.company = { id: user.company_id };
    req.user = { role: req.role, firebase_uid };

    next();
  } catch (err) {
    console.error('❌ attachUserContext error:', err.message);
    res.status(500).json({ error: 'Failed to attach user context.' });
  }
};

// ✅ Routes
router.get('/projects', verifyToken, attachUserContext, chatController.getProjects);
router.get('/:projectId/messages', verifyToken, attachUserContext, chatController.getMessages);
router.post('/:projectId/messages', verifyToken, attachUserContext, chatController.sendMessage);

module.exports = router;
