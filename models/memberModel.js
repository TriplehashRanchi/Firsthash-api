// File: backend/models/memberModel.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

async function createEmployee({
  firebase_uid,
  employee_type,
  email,
  name,
  phone,
  company_id,
}) {
  console.log(firebase_uid,
  employee_type,
  email,
  name,
  phone,
  company_id,);
  // const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  await pool.execute(
    `INSERT INTO employees
      (firebase_uid, employee_type, email, name, phone, company_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [firebase_uid, employee_type, email, name, phone, company_id, , 'active']
  );

  const [[row]] = await pool.execute(
    `SELECT
       firebase_uid,
       email,
       name,
       phone,
       company_id,
       employee_type,
       status,
       created_at,
       updated_at
     FROM employees
     WHERE firebase_uid = ?`,
    [firebase_uid]
  );
  return row;
}

async function assignRole({ firebase_uid, role_id }) {
  await pool.execute(
    `INSERT INTO employee_role_assignments
       (firebase_uid, role_id)
     VALUES (?, ?)`,
    [firebase_uid, role_id]
  );

  const [[assignment]] = await pool.execute(
    `SELECT firebase_uid, role_id, assigned_at
     FROM employee_role_assignments
     WHERE firebase_uid = ? AND role_id = ?
     ORDER BY assigned_at DESC
     LIMIT 1`,
    [firebase_uid, role_id]
  );
  return assignment;
}

// async function fetchAllEmployees() {
//   const [rows] = await pool.execute(
//     `SELECT
//        e.firebase_uid,
//        e.name,
//        e.email,
//        e.phone,
//        e.employee_type,
//        e.status,
//        e.address,
//        e.salary,
//        r.role_id
//      FROM employees e
//      LEFT JOIN employee_role_assignments r
//        ON e.firebase_uid = r.firebase_uid`
//   );
//   return rows;
// }

async function fetchAllEmployees() {
  const [rows] = await pool.execute(
    `SELECT
       e.firebase_uid,
       e.name,
       e.email,
       e.phone,
       e.employee_type,
       e.status,
       e.address,
       e.salary,
       -- Group role IDs into a single JSON array
       JSON_ARRAYAGG(r.role_id) as role_ids
     FROM employees e
     LEFT JOIN employee_role_assignments r ON e.firebase_uid = r.firebase_uid
     GROUP BY e.firebase_uid`
  );

  // Process the result to handle users with no roles
  return rows.map(row => ({
    ...row,
    role_ids: row.role_ids[0] === null ? [] : row.role_ids,
  }));
}

async function fetchEmployeeByUid(uid) {
  const [[row]] = await pool.execute(
    `SELECT
       e.firebase_uid,
       e.name,
       e.email,
       e.phone,
       e.employee_type,
       e.status,
       e.address,
       e.salary,
       r.role_id
     FROM employees e
     LEFT JOIN employee_role_assignments r
       ON e.firebase_uid = r.firebase_uid
     WHERE e.firebase_uid = ?`,
    [uid]
  );
  return row;
}

async function editEmployee(uid, updates) {
  const allowed = ['name', 'email', 'phone', 'employee_type', 'status', 'address', 'salary'];
  const fields = [];
  const params = [];
  for (const key of allowed) {
    if (key in updates) {
      fields.push(`${key} = ?`);
      params.push(updates[key]);
    }
  }
  params.push(uid);

  await pool.execute(
    `UPDATE employees
     SET ${fields.join(', ')}
     WHERE firebase_uid = ?`,
    params
  );
  return fetchEmployeeByUid(uid);
}

async function removeEmployee(uid) {
  await pool.execute(`DELETE FROM employee_role_assignments WHERE firebase_uid = ?`, [uid]);
  await pool.execute(`DELETE FROM employees WHERE firebase_uid = ?`, [uid]);
}

// memberModels.js
async function fetchAttendanceForUid(uid) {
  const [rows] = await pool.execute(
    `SELECT a_id, firebase_uid, a_date, in_time, out_time, a_status
     FROM attendance
     WHERE firebase_uid = ?
     ORDER BY a_date DESC`, // Order by the correct column name
    [uid]
  );
  return rows;
}

async function upsertAttendance(records) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const sql = `
            INSERT INTO attendance (firebase_uid, a_date, in_time, out_time, a_status)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                in_time = VALUES(in_time),
                out_time = VALUES(out_time),
                a_status = VALUES(a_status)
        `;
        for (const rec of records) {
            await conn.execute(sql, [
                rec.firebase_uid,
                rec.a_date,
                rec.in_time || null,
                rec.out_time || null,
                rec.a_status,
            ]);
        }
        await conn.commit();
        return { success: true, message: 'Attendance updated successfully.' };
    } catch (err) {
        await conn.rollback();
        console.error("Upsert attendance error:", err);
        throw new Error('Failed to save attendance data.');
    } finally {
        conn.release();
    }
}

// ADD THIS NEW FUNCTION FOR THE DASHBOARD
async function fetchAllAttendance() {
    const [rows] = await pool.execute('SELECT * FROM attendance ORDER BY a_date DESC');
    return rows;
}

async function removeRoleAssignments(firebase_uid) {
  await pool.execute(
    `DELETE FROM employee_role_assignments WHERE firebase_uid = ?`,
    [firebase_uid]
  );
}

async function fetchPaymentDetails(uid) {
  const [rows] = await pool.execute(
    `SELECT bank_name, branch_name, ifsc_code, account_number, account_holder, account_type, upi_id
     FROM employee_payment_details
     WHERE firebase_uid = ?`,
    [uid]
  );
  return rows[0] || {};
}

// File: backend/models/memberModel.js
async function upsertPaymentDetails(uid, {
  bank_name      = null,
  branch_name    = null,
  ifsc_code      = null,
  account_number = null,
  account_holder = null,
  account_type   = null,
  upi_id         = null
} = {}) {
  await pool.execute(
    `INSERT INTO employee_payment_details
       (firebase_uid, bank_name, branch_name, ifsc_code, account_number, account_holder, account_type, upi_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       bank_name      = VALUES(bank_name),
       branch_name    = VALUES(branch_name),
       ifsc_code      = VALUES(ifsc_code),
       account_number = VALUES(account_number),
       account_holder = VALUES(account_holder),
       account_type   = VALUES(account_type),
       upi_id         = VALUES(upi_id)`,
    [uid, bank_name, branch_name, ifsc_code, account_number, account_holder, account_type, upi_id]
  );
}


module.exports = {
  createEmployee,
  assignRole,
  fetchAllEmployees,
  fetchEmployeeByUid,
  editEmployee,
  removeEmployee,
  fetchAttendanceForUid,
  removeRoleAssignments,
  fetchPaymentDetails,
  upsertPaymentDetails,
  fetchAllAttendance,
  upsertAttendance
};
