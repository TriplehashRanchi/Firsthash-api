// models/companyModel.js
const db = require('../config/db');

const createCompany = async ({ id, name, owner_admin_uid }) => {
  const [rows] = await db.query(
    `INSERT INTO companies (id, name, owner_admin_uid)
     VALUES (?, ?, ?)`,
    [id, name, owner_admin_uid]
  );
  return rows;
};

const getCompanyByOwnerUid = async (firebase_uid) => {
  const [rows] = await db.query(
    `SELECT * FROM companies WHERE owner_admin_uid = ?`,
    [firebase_uid]
  );
  return rows[0];
};



module.exports = { createCompany, getCompanyByOwnerUid };
