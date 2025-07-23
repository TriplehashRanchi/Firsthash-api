/*
File: backend/models/roleModel.js
Description: CRUD operations for employee_roles table
*/

const pool = require('../config/db');

async function getAllRoles(companyId) {
  const sql = `SELECT id, type_name, role_code, company_id, created_at, updated_at
               FROM employee_roles
               WHERE company_id = ?`;
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

module.exports = {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
};
