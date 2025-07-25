// File: backend/models/attendanceModel.js
const pool = require('../config/db');

/**
 * Fetch all attendance records (with employee name)
 */
async function fetchAllAttendance() {
  const [rows] = await pool.execute(
    `SELECT
       a.a_id,
       a.firebase_uid,
       e.name,
       a.a_date,
       a.in_time,
       a.out_time,
       a.a_status
     FROM attendance a
     JOIN employees e       ON a.firebase_uid = e.firebase_uid
     ORDER BY a.a_date DESC, e.name`);
  return rows;
}

/**
 * Fetch attendance for a single employee
 */
async function fetchAttendanceForUid(uid) {
  const [rows] = await pool.execute(
    `SELECT
       a.a_id,
       a.firebase_uid,
       a.a_date,
       a.in_time,
       a.out_time,
       a.a_status
     FROM attendance a
     WHERE a.firebase_uid = ?
     ORDER BY a.a_date DESC`,
    [uid]
  );
  return rows;
}

/**
 * Insert or update attendance for a given record
 * @param {Object} rec
 * @param {string} rec.firebase_uid
 * @param {string} rec.a_date      // 'YYYY-MM-DD'
 * @param {string|null} rec.in_time // 'HH:MM:SS' or null
 * @param {string|null} rec.out_time// 'HH:MM:SS' or null
 * @param {number} rec.a_status     // 1 = present, 0 = absent
 */

async function upsertAttendance({
  firebase_uid,
  a_date,
  in_time  = null,
  out_time = null,
  a_status
}) {
  // Now we know none of these are undefined
  await pool.execute(
    `INSERT INTO attendance
       (firebase_uid, a_date, in_time, out_time, a_status)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       in_time  = VALUES(in_time),
       out_time = VALUES(out_time),
       a_status = VALUES(a_status)`,
    [firebase_uid, a_date, in_time, out_time, a_status]
  );
}

module.exports = {
  fetchAllAttendance,
  fetchAttendanceForUid,
  upsertAttendance
};

