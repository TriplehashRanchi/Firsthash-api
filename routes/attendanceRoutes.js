// File: backend/routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllAttendance,
  getAttendanceByUser,
  markAttendance
} = require('../controllers/attendanceController');

// Return all attendance
router.get('/', getAllAttendance);
// Return attendance for a single user
router.get('/:uid', getAttendanceByUser);
// Bulk mark attendance
router.post('/', markAttendance);

module.exports = router;