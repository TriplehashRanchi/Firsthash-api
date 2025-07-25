/*
File: backend/models/roleModel.js
Description: CRUD operations for employee_roles table
*/

const pool = require('../config/db');

async function getAllRoles(companyId) {
  const sql = `SELECT id, type_name, role_code, company_id, created_at, updated_at
               FROM employee_roles
               WHERE company_id = ? OR company_id = '00000000-0000-0000-0000-000000000000'`;
  const [rows] = await pool.execute(sql, [companyId]);
  return rows;
}

async function getRoleById(id) {
  const [rows] = await pool.execute(
    `SELECT id, type_name, role_code, company_id, created_at, updated_at
     FROM employee_roles
     WHERE id = ?`,
    [id]
  );
  return rows[0];
}

async function createRole({ type_name, role_code, company_id }) {
  const sql = `INSERT INTO employee_roles (type_name, role_code, company_id)
               VALUES (?, ?, ?)`;
  const [result] = await pool.execute(sql, [type_name, role_code, company_id]);
  return getRoleById(result.insertId);
}

async function updateRole(id, { type_name, role_code }) {
  await pool.execute(
    `UPDATE employee_roles
     SET type_name = ?, role_code = ?
     WHERE id = ?`,
    [type_name, role_code, id]
  );
  return getRoleById(id);
}

async function deleteRole(id) {
  await pool.execute(`DELETE FROM employee_roles WHERE id = ?`, [id]);
}

// — new: assignment helpers —
async function assignRoleToUser(firebase_uid, role_id) {
  const sql = `
    INSERT IGNORE INTO employee_role_assignments
      (firebase_uid, role_id)
    VALUES (?, ?)
  `;
  await pool.execute(sql, [firebase_uid, role_id]);
}

async function removeRoleFromUser(firebase_uid, role_id) {
  const sql = `
    DELETE FROM employee_role_assignments
    WHERE firebase_uid = ? AND role_id = ?
  `;
  await pool.execute(sql, [firebase_uid, role_id]);
}

async function getUserRoles(firebase_uid) {
  const sql = `
    SELECT r.id, r.type_name, r.role_code, r.company_id, a.assigned_at
    FROM employee_role_assignments a
    JOIN employee_roles r ON a.role_id = r.id
    WHERE a.firebase_uid = ?
  `;
  const [rows] = await pool.execute(sql, [firebase_uid]);
  return rows;
}


module.exports = {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  assignRoleToUser,
  removeRoleFromUser,
  getUserRoles
};
