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

// --- START: ADD THIS NEW FUNCTION ---
/**
 * Fetches a single company's complete details by its UUID.
 * @param {string} companyId - The UUID of the company.
 * @returns {Promise<object|null>} The company object or null if not found.
 */
const getCompanyById = async (companyId) => {
  const [[company]] = await db.query(
    `SELECT * FROM companies WHERE id = ?`,
    [companyId]
  );
  return company || null;
};
// --- END: ADD THIS NEW FUNCTION ---


module.exports = { createCompany, getCompanyByOwnerUid, getCompanyById };
