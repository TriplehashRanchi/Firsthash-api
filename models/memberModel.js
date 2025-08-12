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
//        -- If an employee has roles, aggregate them into a JSON array of objects.
//        -- Each object contains the role's ID and name.
//        JSON_ARRAYAGG(
//          CASE
//            WHEN r.role_id IS NOT NULL THEN JSON_OBJECT('role_id', r.role_id, 'role_name', er.type_name)
//            ELSE NULL
//          END
//        ) AS roles
//      FROM employees e
//      LEFT JOIN employee_role_assignments r ON e.firebase_uid = r.firebase_uid
//      LEFT JOIN employee_roles er ON r.role_id = er.id -- Join with roles table to get the name
//      GROUP BY e.firebase_uid`
//   );
//   // Post-process to clean up the 'roles' field.
//   // If an employee has no roles, JSON_ARRAYAGG returns [null]. This code changes it to an empty array [].
//   return rows.map(row => ({
//     ...row,
//     roles: row.roles && row.roles[0] !== null ? row.roles : [],
//   }));
// }

// This is your fetchAllEmployees function, improved to be secure by filtering by company.
async function fetchAllEmployees(company_id) {
  const [rows] = await pool.execute(
    `
    SELECT
       e.firebase_uid, e.name, e.email, e.phone, e.employee_type, e.status, e.address, e.salary,
       JSON_ARRAYAGG(
         CASE WHEN r.role_id IS NOT NULL THEN JSON_OBJECT('role_id', r.role_id, 'role_name', er.type_name) ELSE NULL END
       ) AS roles
     FROM employees e
     LEFT JOIN employee_role_assignments r ON e.firebase_uid = r.firebase_uid
     LEFT JOIN employee_roles er ON r.role_id = er.id
     WHERE e.company_id = ?
     GROUP BY e.firebase_uid`,
    [company_id]
  );
  return rows.map(row => ({
    ...row,
    roles: row.roles && row.roles[0] !== null ? row.roles : [],
  }));
}

/**
 * UPDATED FUNCTION
 * Fetches a single employee by their UID, including their assigned roles (ID and name).
 */
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
       JSON_ARRAYAGG(
         CASE
           WHEN r.role_id IS NOT NULL THEN JSON_OBJECT('role_id', r.role_id, 'role_name', er.type_name)
           ELSE NULL
         END
       ) AS roles
     FROM employees e
     LEFT JOIN employee_role_assignments r ON e.firebase_uid = r.firebase_uid
     LEFT JOIN employee_roles er ON r.role_id = er.id
     WHERE e.firebase_uid = ?
     GROUP BY e.firebase_uid`,
    [uid]
  );
  
  if (!row) return null;

  // Ensure the 'roles' field is a clean array.
  return {
      ...row,
      roles: row.roles && row.roles[0] !== null ? row.roles : []
  };
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


// Your function to update the base salary in the 'employees' table.
async function updateEmployeeSalary(uid, salary, company_id) {
  await pool.execute(
    `UPDATE employees SET salary = ? WHERE firebase_uid = ? AND company_id = ?`,
    [salary, uid, company_id]
  );
  return fetchEmployeeByUid(uid);
}


// NEW: Fetches all generated monthly salary records.
async function fetchCompanySalaries(company_id) {
  const [rows] = await pool.execute(
    `
    SELECT 
      s.id, s.firebase_uid, s.period_month, s.period_year, s.amount_due, s.amount_paid, s.status, s.notes,
      e.name AS employee_name
    FROM employee_salaries s
    JOIN employees e ON e.firebase_uid = s.firebase_uid COLLATE utf8mb4_unicode_ci
    WHERE s.company_id = ?
    ORDER BY s.period_year DESC, s.period_month DESC, e.name ASC`,
    [company_id]
  );
  return rows;
}

// NEW: Updates a single monthly salary record.
async function updateMonthlySalaryRecord({ id, company_id, amount_paid, status, notes }) {
  await pool.execute(
    `UPDATE employee_salaries SET amount_paid = ?, status = ?, notes = ? WHERE id = ? AND company_id = ?`,
    [amount_paid, status, notes, id, company_id]
  );
}

// NEW: Generates new monthly records in 'employee_salaries'.
async function generateMonthlySalaryRecords(company_id, month, year) {
  const query = `
    INSERT INTO employee_salaries (company_id, firebase_uid, period_month, period_year, amount_due, status)
    SELECT ?, firebase_uid, ?, ?, salary, 'pending'
    FROM employees
    WHERE company_id = ? AND employee_type = 1 AND salary IS NOT NULL AND salary > 0
    ON DUPLICATE KEY UPDATE amount_due = VALUES(amount_due);
  `;
  const [result] = await pool.execute(query, [company_id, month, year, company_id]);
  return result;
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
  upsertAttendance,
  updateEmployeeSalary,
  fetchCompanySalaries,
  updateMonthlySalaryRecord,
  generateMonthlySalaryRecords
};
