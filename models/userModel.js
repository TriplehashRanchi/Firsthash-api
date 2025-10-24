const db = require('../config/db');

const getAdminByUID = async (firebase_uid) => {
  const [rows] = await db.query(
    `SELECT * FROM admins WHERE firebase_uid = ?`,
    [firebase_uid]
  );
  return rows[0];
};

const getEmployeeByUID = async (firebase_uid) => {
  const [rows] = await db.query(
    `SELECT * FROM employees WHERE firebase_uid = ?`,
    [firebase_uid]
  );
  return rows[0];
};

// ✅ New: find user by phone for login
const findUserByPhone = async (phone) => {
  // Normalize to last 10 digits (Indian numbers)
  const normalized = phone.replace(/^(\+91|91)/, ""); // remove +91 or 91

  // Check with last 10 digits
  let [rows] = await db.query(`SELECT * FROM employees WHERE phone = ?`, [normalized]);
  if (rows.length > 0) return rows[0];

  // Check with +91 format
  [rows] = await db.query(`SELECT * FROM employees WHERE phone = ?`, [`+91${normalized}`]);
  if (rows.length > 0) return rows[0];

  // Check with 91 format
  [rows] = await db.query(`SELECT * FROM employees WHERE phone = ?`, [`91${normalized}`]);
  if (rows.length > 0) return rows[0];

  // Repeat for admins
  [rows] = await db.query(`SELECT * FROM admins WHERE phone = ?`, [normalized]);
  if (rows.length > 0) return rows[0];

  [rows] = await db.query(`SELECT * FROM admins WHERE phone = ?`, [`+91${normalized}`]);
  if (rows.length > 0) return rows[0];

  [rows] = await db.query(`SELECT * FROM admins WHERE phone = ?`, [`91${normalized}`]);
  if (rows.length > 0) return rows[0];

  return null;
};

// ✅ New: get multiple users (assignees) by IDs
const getUsersByIds = async (userIds = []) => {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];

  // Convert to placeholders for safe query
  const placeholders = userIds.map(() => '?').join(',');

  // Try fetching from employees first
  const [employeeRows] = await db.query(
    `SELECT id, name, phone FROM employees WHERE id IN (${placeholders})`,
    userIds
  );

  // Then fetch matching admins (if any)
  const [adminRows] = await db.query(
    `SELECT id, name, phone FROM admins WHERE id IN (${placeholders})`,
    userIds
  );

  // Merge both arrays (employees + admins)
  return [...employeeRows, ...adminRows];
};
// models/userModel.js

const getUsersByFirebaseUids = async (firebaseUids = []) => {
  if (!Array.isArray(firebaseUids) || firebaseUids.length === 0) return [];

  const placeholders = firebaseUids.map(() => '?').join(',');

  const [employees] = await db.query(
    `SELECT firebase_uid, name, phone FROM employees WHERE firebase_uid IN (${placeholders})`,
    firebaseUids
  );

  const [admins] = await db.query(
    `SELECT firebase_uid, name, phone FROM admins WHERE firebase_uid IN (${placeholders})`,
    firebaseUids
  );

  return [...employees, ...admins];
};



module.exports = { getAdminByUID, getEmployeeByUID, findUserByPhone, getUsersByIds, getUsersByFirebaseUids };
