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

/**
 * NEW FUNCTION: Fetches an admin's profile by their Firebase UID.
 * We select all the fields needed for the profile page.
 */
const getAdminByUID = async (firebase_uid) => {
  const [rows] = await db.query(
    `SELECT firebase_uid, email, name, phone, photo, company_id, status FROM admins WHERE firebase_uid = ?`,
    [firebase_uid]
  );
  return rows[0]; // Returns the admin object or undefined if not found
};

/**
 * NEW FUNCTION: Updates an admin's profile by their Firebase UID.
 * The `updatedData` object will contain the fields to be changed.
 */
const updateAdminByUID = async (firebase_uid, updatedData) => {
  const [result] = await db.query(
    `UPDATE admins SET ? WHERE firebase_uid = ?`, 
    [updatedData, firebase_uid]
  );
  return result; // Returns info about the query, like affectedRows
};

const updateFBToken = async (firebase_uid, fbAccessToken, fbTokenExpiry) => {
  const [result] = await db.query(
    `
    UPDATE fb_connections
    SET access_token = ?, token_expires_at = ?, status = 'active', updated_at = CURRENT_TIMESTAMP
    WHERE admin_firebase_uid = ? AND status = 'active'
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [fbAccessToken, fbTokenExpiry, firebase_uid]
  );

  if (result.affectedRows > 0) return result;

  const [fallbackResult] = await db.query(
    `
    UPDATE fb_connections
    SET access_token = ?, token_expires_at = ?, status = 'active', updated_at = CURRENT_TIMESTAMP
    WHERE admin_firebase_uid = ?
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [fbAccessToken, fbTokenExpiry, firebase_uid]
  );

  return fallbackResult;
};

module.exports = {
  createAdmin,
  getAdminByUID,      // <-- Export the new function
  updateAdminByUID,   // <-- Export the new function
  updateFBToken,
};
