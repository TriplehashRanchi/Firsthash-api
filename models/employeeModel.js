// backend/models/employeeModel.js
const db = require('../config/db');

/**
 * All tasks assigned to the given employee (with project name).
 */
exports.getTasksAssignedToUser = async (companyId, firebaseUid) => {
  const sql = `
    SELECT 
      t.id,
      t.title,
      t.description,
      t.status,
      t.priority,
      t.due_date,
      t.project_id,
      t.deliverable_id,
      p.name AS project_name,
      GROUP_CONCAT(DISTINCT ta.employee_firebase_uid) AS assignee_ids
    FROM tasks t
    INNER JOIN task_assignees ta ON t.id = ta.task_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.company_id = ?
      AND EXISTS (
        SELECT 1 
        FROM task_assignees x 
        WHERE x.task_id = t.id 
          AND x.employee_firebase_uid = ?
      )
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `;
  const [rows] = await db.query(sql, [companyId, firebaseUid]);
  return rows;
};

/**
 * Projects where the employee is involved (via tasks OR shoot assignments).
 */
exports.getProjectsAssignedToUser = async (companyId, firebaseUid) => {
  const sql = `
    SELECT
      p.id,
      p.name,
      p.status,
      c.name AS clientName,
      (SELECT MIN(s.date) FROM shoots s WHERE s.project_id = p.id) AS minDate,
      (SELECT MAX(s.date) FROM shoots s WHERE s.project_id = p.id) AS maxDate,
      (SELECT COUNT(*) FROM shoots s WHERE s.project_id = p.id) AS shoots,
      (SELECT COUNT(*) FROM deliverables d WHERE d.project_id = p.id) AS deliverablesTotal,
      (SELECT COUNT(*) FROM deliverables d WHERE d.project_id = p.id AND d.status = 'completed') AS deliverablesCompleted
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    WHERE p.company_id = ?
      AND p.id IN (
        -- via tasks
        SELECT DISTINCT t.project_id
        FROM tasks t
        JOIN task_assignees ta ON ta.task_id = t.id
        WHERE t.company_id = ? AND ta.employee_firebase_uid = ?
        UNION
        -- via shoot assignments
        SELECT DISTINCT s.project_id
        FROM shoot_assignments sa
        JOIN shoots s ON s.id = sa.shoot_id
        JOIN projects p2 ON p2.id = s.project_id
        WHERE p2.company_id = ? AND sa.employee_firebase_uid = ?
      )
    ORDER BY p.created_at DESC
  `;
  const params = [companyId, companyId, firebaseUid, companyId, firebaseUid];
  const [rows] = await db.query(sql, params);
  return rows;
};

/**
 * Authorization helper: is employee assigned to the project?
 */
exports.isEmployeeAssignedToProject = async (companyId, projectId, firebaseUid) => {
  const sql = `
    SELECT 1 FROM tasks t
      JOIN task_assignees ta ON ta.task_id = t.id
      WHERE t.company_id = ? AND t.project_id = ? AND ta.employee_firebase_uid = ?
    UNION
    SELECT 1 FROM shoot_assignments sa
      JOIN shoots s ON s.id = sa.shoot_id
      JOIN projects p ON p.id = s.project_id
      WHERE p.company_id = ? AND p.id = ? AND sa.employee_firebase_uid = ?
    LIMIT 1
  `;
  const params = [companyId, projectId, firebaseUid, companyId, projectId, firebaseUid];
  const [rows] = await db.query(sql, params);
  return rows.length > 0;
};

/**
 * Lean project details for employee view.
 */
exports.getProjectDetailsView = async (companyId, projectId) => {
  // Project + client
  const [projRows] = await db.query(
    `
    SELECT
      p.id,
      p.name,
      p.status,
      p.package_cost                 AS packageCost,
      p.additional_deliverables_cost AS additionalCost,
      p.total_cost                   AS totalCost,
      c.name                         AS clientName
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    WHERE p.id = ? AND p.company_id = ?
    LIMIT 1
    `,
    [projectId, companyId]
  );

  const proj = projRows[0];
  if (!proj) return null;

  // Shoots
  const [shootRows] = await db.query(
    `
    SELECT id, title, date, time, city
    FROM shoots
    WHERE project_id = ?
    ORDER BY date ASC, time ASC
    `,
    [projectId]
  );

  // Deliverables
  const [delivRows] = await db.query(
    `
    SELECT
      id,
      title,
      status,
      is_additional_charge,
      additional_charge_amount,
      estimated_date AS date
    FROM deliverables
    WHERE project_id = ?
    ORDER BY created_at ASC
    `,
    [projectId]
  );

  // Shape response
  return {
    projectName: proj.name,
    projectStatus: proj.status,
    projectPackageCost: Number(proj.packageCost || 0),
    deliverablesAdditionalCost: Number(proj.additionalCost || 0),
    overallTotalCost: Number(proj.totalCost || 0),
    clientName: proj.clientName,

    shoots: {
      shootList: shootRows.map(s => ({
        id: s.id,
        title: s.title,
        date: s.date,
        time: s.time,
        city: s.city,
        selectedServices: {},
        assignments: {},
      })),
    },

    deliverables: {
      deliverableItems: delivRows.map(d => ({
        id: d.id,
        title: d.title,
        status: d.status,
        is_additional_charge: !!d.is_additional_charge,
        additional_charge_amount: Number(d.additional_charge_amount || 0),
        date: d.date,
      })),
    },

    // aliases for UI
    status: proj.status,
    name: proj.name,
    packageCost: Number(proj.packageCost || 0),
    additionalCost: Number(proj.additionalCost || 0),
    totalCost: Number(proj.totalCost || 0),
  };
};


/**
 * Fetches the salary payment history for a specific employee.
 */
exports.fetchSalaryHistory = async (companyId, firebaseUid) => {
    const sql = `
        SELECT id, period_month, period_year, amount_due, amount_paid, status, notes
        FROM employee_salaries
        WHERE company_id = ? AND firebase_uid = ?
        ORDER BY period_year DESC, period_month DESC;
    `;
    const [rows] = await db.query(sql, [companyId, firebaseUid]);
    return rows;
};

/**
 * Fetches a financial summary (total paid, total due) for a salaried employee.
 */
exports.fetchSalarySummary = async (companyId, firebaseUid) => {
    const sql = `
        SELECT
            COALESCE(SUM(amount_due), 0) AS totalDue,
            COALESCE(SUM(amount_paid), 0) AS totalPaid,
            MAX(updated_at) AS lastPaymentDate 
        FROM employee_salaries
        WHERE company_id = ? AND firebase_uid = ?;
    `;
    const [[summary]] = await db.query(sql, [companyId, firebaseUid]);
    return summary;
};

/**
 * Fetches all expenses associated with a specific employee.
 */
exports.fetchExpenses = async (companyId, firebaseUid) => {
    const sql = `
        SELECT 
            ex.id, 
            ex.description, 
            ex.category, 
            ex.amount, 
            ex.expense_date,
            p.name as projectName
        FROM expenses ex
        LEFT JOIN projects p ON ex.project_id = p.id
        WHERE 
            ex.company_id = ?
            AND ex.project_id IN (
                -- Subquery to find all unique project IDs the employee is part of
                SELECT DISTINCT t.project_id
                FROM tasks t
                JOIN task_assignees ta ON ta.task_id = t.id
                WHERE t.company_id = ? AND ta.employee_firebase_uid = ? AND t.project_id IS NOT NULL
                UNION
                SELECT DISTINCT s.project_id
                FROM shoot_assignments sa
                JOIN shoots s ON s.id = sa.shoot_id
                JOIN projects p2 ON p2.id = s.project_id
                WHERE p2.company_id = ? AND sa.employee_firebase_uid = ?
            )
        ORDER BY ex.expense_date DESC;
    `;
    const params = [companyId, companyId, firebaseUid, companyId, firebaseUid];
    const [rows] = await db.query(sql, params);
    return rows;
};