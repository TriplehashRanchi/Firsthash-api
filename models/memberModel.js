// File: backend/models/memberModel.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

// backend/models/memberModel.js
async function createEmployee({
  firebase_uid,
  employee_type,
  email,
  name,
  phone,
  alternate_phone = null,
  company_id,
}) {
  await pool.execute(
    `INSERT INTO employees
      (firebase_uid, employee_type, email, name, phone, alternate_phone, company_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [firebase_uid, employee_type, email, name, phone, alternate_phone, company_id, 'active'] // <-- fixed
  );

  const [[row]] = await pool.execute(
    `SELECT
       firebase_uid, email, name, phone, alternate_phone, company_id, employee_type, status, created_at, updated_at
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

async function assignRoles({ firebase_uid, role_ids }) {
  // 1. Safety check: If no roles are provided, do nothing.
  if (!role_ids || !Array.isArray(role_ids) || role_ids.length === 0) {
      return;
  }

  // 2. Prepare data for bulk insert.
  // mysql2 expects an array of arrays: [[uid, roleId1], [uid, roleId2], ...]
  const valuesToInsert = role_ids.map(roleId => [firebase_uid, roleId]);

  // 3. Execute the bulk insert query.
  // Note: We use pool.query (not execute) and the VALUES ? syntax for bulk inserts
  const sql = `INSERT INTO employee_role_assignments (firebase_uid, role_id) VALUES ?`;

  await pool.query(sql, [valuesToInsert]);
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
       e.firebase_uid, e.name, e.email, e.phone, e.alternate_phone, e.employee_type, e.status, e.address, e.salary,
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
  return rows.map(row => {
    let roles = [];
    try {
        if (row.roles && typeof row.roles === 'string' && row.roles.trim() !== '' && row.roles !== '[null]') {
            const parsedRoles = JSON.parse(row.roles);
            // Ensure we don't return [null] for employees with no roles
            if (Array.isArray(parsedRoles) && parsedRoles[0] !== null) {
                roles = parsedRoles;
            }
        } else if (Array.isArray(row.roles) && row.roles[0] !== null) {
            roles = row.roles;
        }
    } catch (e) {
        console.error("Failed to parse roles JSON in fetchAllEmployees:", row.roles);
    }
    return { ...row, roles };
  });
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
       e.alternate_phone,
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
  const allowed = ['name', 'email', 'phone', 'alternate_phone', 'employee_type', 'status', 'address', 'salary'];
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

async function ensureAbsentMarked(company_id, date) {
  // get all active employees
  const [members] = await pool.execute(
    `SELECT firebase_uid FROM employees WHERE company_id = ? AND status = 'active'`,
    [company_id]
  );

  for (const member of members) {
    const [existing] = await pool.execute(
      `SELECT a_id FROM attendance WHERE firebase_uid = ? AND a_date = ?`,
      [member.firebase_uid, date]
    );

    if (existing.length === 0) {
      await pool.execute(
        `INSERT INTO attendance (firebase_uid, a_date, a_status)
         VALUES (?, ?, ?)`,
        [member.firebase_uid, date, 0] // 0 = Absent
      );
    }
  }
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
    WHERE company_id = ? AND employee_type IN (1, 2) AND salary IS NOT NULL AND salary > 0
    ON DUPLICATE KEY UPDATE amount_due = VALUES(amount_due);
  `;
  const [result] = await pool.execute(query, [company_id, month, year, company_id]);
  return result;
}

async function fetchSalaryHistoryForEmployee(uid, company_id) {
  const [rows] = await pool.execute(
    `
    SELECT 
      id, firebase_uid, period_month, period_year, amount_due, amount_paid, status, notes
    FROM employee_salaries
    WHERE firebase_uid = ? AND company_id = ?
    ORDER BY period_year DESC, period_month DESC`,
    [uid, company_id]
  );
  console.log(rows);
  return rows;
}


async function paySingleMonthSalary(salaryId, company_id) {
  const query = `
    UPDATE employee_salaries 
    SET amount_paid = amount_due, status = 'complete' 
    WHERE id = ? AND company_id = ?`;
  const [result] = await pool.execute(query, [salaryId, company_id]);
  return result;
}

// NEW: Marks all unpaid or partially paid salaries for an employee as fully paid.
async function payAllDueSalariesForEmployee(employeeUid, company_id) {
  const query = `
    UPDATE employee_salaries
    SET amount_paid = amount_due, status = 'complete'
    WHERE firebase_uid = ? 
      AND company_id = ? 
      AND (amount_paid < amount_due OR amount_paid IS NULL)`;
  const [result] = await pool.execute(query, [employeeUid, company_id]);
  return result;
}

// REPLACE the existing fetchFreelancerSummaries function with this one.

async function fetchFreelancerSummaries(company_id) {
  const query = `
    SELECT
        e.firebase_uid, e.name,
        JSON_ARRAYAGG(CASE WHEN r.role_id IS NOT NULL THEN JSON_OBJECT('role_id', r.role_id, 'role_name', er.type_name) ELSE NULL END) AS roles,
        COALESCE((SELECT SUM(fb.fee) FROM freelancer_billings fb WHERE fb.freelancer_uid = e.firebase_uid AND fb.company_id = ?), 0) as total_billed,
        COALESCE((SELECT SUM(fp.payment_amount) FROM freelancer_payments fp WHERE fp.freelancer_uid = e.firebase_uid), 0) as total_paid,
        (
            (SELECT COUNT(sa.id) FROM shoot_assignments sa WHERE sa.employee_firebase_uid = e.firebase_uid AND NOT EXISTS (SELECT 1 FROM freelancer_billings fb WHERE fb.assignment_id = sa.id AND fb.assignment_type = 'shoot')) +
            (SELECT COUNT(ta.task_id) FROM task_assignees ta WHERE ta.employee_firebase_uid = e.firebase_uid AND NOT EXISTS (SELECT 1 FROM freelancer_billings fb WHERE fb.assignment_type = 'task' AND fb.assignment_id_composite = CONCAT(ta.task_id, '-', ta.employee_firebase_uid)))
        ) as unbilled_assignments_count
    FROM employees e
    LEFT JOIN employee_role_assignments r ON e.firebase_uid = r.firebase_uid
    LEFT JOIN employee_roles er ON r.role_id = er.id
    WHERE e.company_id = ? AND e.employee_type = 0 AND e.status = 'active'
    GROUP BY e.firebase_uid`;

  const [freelancers] = await pool.execute(query, [company_id, company_id]);
  return freelancers.map(f => {
      let roles = [];
      try {
          if (f.roles && typeof f.roles === 'string' && f.roles.trim() !== '' && f.roles !== '[null]') {
            const parsedRoles = JSON.parse(f.roles);
             if(Array.isArray(parsedRoles) && parsedRoles[0] !== null) {
                roles = parsedRoles;
            }
          } else if (Array.isArray(f.roles) && f.roles[0] !== null) {
              roles = f.roles;
          }
      } catch(e) {
          console.error("Failed to parse freelancer roles JSON:", f.roles);
      }
      return {
          ...f,
          roles,
          remaining_balance: (parseFloat(f.total_billed) - parseFloat(f.total_paid)).toFixed(2)
      };
  });
}

async function fetchUnbilledAssignmentsForFreelancer(freelancer_uid) {
  // Shoots query is correct and uses its unique 'id'
  const shootsQuery = `
      SELECT sa.id, 'shoot' as type, CONCAT(p.name, ' - ', sa.service_name) as title
      FROM shoot_assignments sa
      LEFT JOIN freelancer_billings fb ON sa.id = fb.assignment_id AND fb.assignment_type = 'shoot'
      JOIN shoots s ON sa.shoot_id = s.id
      JOIN projects p ON s.project_id = p.id
      WHERE sa.employee_firebase_uid = ? AND fb.id IS NULL`;
  const [shootAssignments] = await pool.execute(shootsQuery, [freelancer_uid]);

  // CORRECTED TASKS QUERY
  // It now creates a composite ID for the frontend to use
  const tasksQuery = `
      SELECT 
          CONCAT(ta.task_id, '-', ta.employee_firebase_uid) as id, 
          'task' as type, 
          t.title
      FROM task_assignees ta
      LEFT JOIN freelancer_billings fb ON fb.assignment_id_composite = CONCAT(ta.task_id, '-', ta.employee_firebase_uid) AND fb.assignment_type = 'task'
      JOIN tasks t ON ta.task_id = t.id
      WHERE ta.employee_firebase_uid = ? AND fb.id IS NULL AND t.project_id IS NOT NULL`;
  const [taskAssignments] = await pool.execute(tasksQuery, [freelancer_uid]);
  
  return [...shootAssignments, ...taskAssignments];
}


async function billAssignment({ freelancer_uid, assignment_type, assignment_id, fee, company_id }) {
  // We now use the appropriate ID based on the type
  let assignmentIdField = 'assignment_id';
  let assignmentIdValue = assignment_id;

  if (assignment_type === 'task') {
      assignmentIdField = 'assignment_id_composite';
  }
  
  const query = `INSERT INTO freelancer_billings (freelancer_uid, assignment_type, ${assignmentIdField}, fee, billing_date, company_id) VALUES (?, ?, ?, ?, ?, ?)`;
  await pool.execute(query, [freelancer_uid, assignment_type, assignmentIdValue, fee, new Date(), company_id]);
}

async function fetchFreelancerHistory(freelancer_uid) {
    // This query is now more complex to handle the lack of ID on tasks
  const billed_items_query = `
      (SELECT 'shoot' as type, sa.id, p.name as project_name, sa.service_name, fb.fee, fb.billing_date 
       FROM freelancer_billings fb 
       JOIN shoot_assignments sa ON fb.assignment_id = sa.id AND fb.assignment_type = 'shoot'
       JOIN shoots s ON sa.shoot_id = s.id 
       JOIN projects p ON s.project_id = p.id 
       WHERE fb.freelancer_uid = ?)
      UNION ALL
      (SELECT 'task' as type, fb.id, t.title as project_name, NULL as service_name, fb.fee, fb.billing_date 
       FROM freelancer_billings fb 
       JOIN tasks t ON SUBSTRING_INDEX(fb.assignment_id_composite, '-', 1) = t.id
       WHERE fb.freelancer_uid = ? AND fb.assignment_type = 'task')
      ORDER BY billing_date DESC`;
  const [billed_items] = await pool.execute(billed_items_query, [freelancer_uid, freelancer_uid]);
  // ... (rest of the function is the same)
  const payments_query = "SELECT id, payment_amount, notes, payment_date FROM freelancer_payments WHERE freelancer_uid = ? ORDER BY payment_date DESC";
  const [payments] = await pool.execute(payments_query, [freelancer_uid]);
  return { billed_items, payments };
}


async function createFreelancerPayment({ freelancer_uid, payment_amount, notes }) {
  await pool.execute(
    "INSERT INTO freelancer_payments (freelancer_uid, payment_amount, notes, payment_date) VALUES (?, ?, ?, ?)",
    [freelancer_uid, payment_amount, notes || null, new Date()]
  );
}

module.exports = {
  createEmployee,
  assignRole,
  assignRoles,
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
  generateMonthlySalaryRecords,
  fetchSalaryHistoryForEmployee,
  paySingleMonthSalary,
  payAllDueSalariesForEmployee,
  fetchFreelancerSummaries,
  createFreelancerPayment,
  fetchFreelancerHistory,
  billAssignment,
  fetchUnbilledAssignmentsForFreelancer,
  ensureAbsentMarked,
};
