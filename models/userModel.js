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


module.exports = { getAdminByUID, getEmployeeByUID, findUserByPhone };
