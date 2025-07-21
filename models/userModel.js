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

module.exports = { getAdminByUID, getEmployeeByUID };
