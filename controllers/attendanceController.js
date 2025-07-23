// File: backend/controllers/attendanceController.js
const {
  fetchAllAttendance,
  fetchAttendanceForUid,
  upsertAttendance
} = require('../models/attendaceModel');

/**
 * GET /api/attendance
 * Returns all attendance records
 */
exports.getAllAttendance = async (req, res) => {
  try {
    const records = await fetchAllAttendance();
    res.json(records);
  } catch (err) {
    console.error('getAllAttendance error:', err.stack || err);
    res.status(500).json({ error: 'Failed to load attendance records' });
  }
};

/**
 * GET /api/attendance/:uid
 * Returns attendance for a specific employee
 */
exports.getAttendanceByUser = async (req, res) => {
  try {
    const { uid } = req.params;
    const records = await fetchAttendanceForUid(uid);
    res.json(records);
  } catch (err) {
    console.error('getAttendanceByUser error:', err.stack || err);
    res.status(500).json({ error: 'Failed to load attendance for user' });
  }
};

/**
 * POST /api/attendance
 * Expects body: array of attendance objects
 */


exports.markAttendance = async (req, res) => {
  try {
    const recs = req.body;
    if (!Array.isArray(recs)) {
      return res.status(400).json({ error: 'Body must be an array of records' });
    }
    for (const rec of recs) {
      // Destructure with defaults (only undefined triggers default)
      const {
        firebase_uid,
        a_date,
        in_time  = null,
        out_time = null,
        a_status
      } = rec;

      // Validate required fields
      if (
        typeof firebase_uid !== 'string' ||
        typeof a_date      !== 'string' ||
        (a_status !== 0 && a_status !== 1)
      ) {
        return res.status(400).json({
          error: 'Each record must include firebase_uid (string), a_date (string), and a_status (0 or 1)'
        });
      }

      // Now safe to call the model
      await upsertAttendance({
        firebase_uid,
        a_date,
        in_time,
        out_time,
        a_status
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('markAttendance error:', err.stack || err);
    res.status(500).json({ error: 'Failed to save attendance' });
  }
};

