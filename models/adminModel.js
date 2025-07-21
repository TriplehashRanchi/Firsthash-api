// models/adminModel.js
const db = require('../config/db');

const createAdmin = async ({ firebase_uid, email, name, phone, company_id }) => {
  const [rows] = await db.query(
    `INSERT INTO admins (firebase_uid, email, name, phone, company_id)
     VALUES (?, ?, ?, ?, ?)`,
    [firebase_uid, email, name, phone, company_id]
  );
  return rows;
};

module.exports = { createAdmin };
