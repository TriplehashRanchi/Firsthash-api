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

/**
 * NEW FUNCTION FOR UPDATING
 * This function updates a company's record based on the owner's UID.
 * The `updatedData` is an object where keys are column names and values are the new data.
 * e.g., { name: 'New Company Name', city: 'New York' }
 */
const updateCompanyByOwnerUid = async (firebase_uid, updatedData) => {
  // The db.query with `SET ?` safely builds the "col = val, col2 = val2" part of the query,
  // preventing SQL injection and allowing you to update only the fields you provide.
  const [result] = await db.query(
    `UPDATE companies SET ? WHERE owner_admin_uid = ?`, 
    [updatedData, firebase_uid]
  );
  return result;
};


// You will also need a function for deleting later on.
const deleteCompanyByOwnerUid = async (firebase_uid) => {
    const [result] = await db.query(
        `DELETE FROM companies WHERE owner_admin_uid = ?`,
        [firebase_uid]
    );
    return result;
};


const getCompanyByEmployeeUid = async (employee_uid) => {
  // This query finds the employee by their UID, then joins to the companies table
  // to get the details of the company they belong to.
  const [rows] = await db.query(
    `
    SELECT c.* 
    FROM companies c 
    JOIN employees e ON c.id = e.company_id 
    WHERE e.firebase_uid = ?
    `,
    [employee_uid]
  );
  return rows[0]; // Return the first company found (should only be one)
};



module.exports = {
  createCompany,
  getCompanyByOwnerUid,
  getCompanyById,
  updateCompanyByOwnerUid, // Export the new function
  deleteCompanyByOwnerUid,
  getCompanyByEmployeeUid
};
