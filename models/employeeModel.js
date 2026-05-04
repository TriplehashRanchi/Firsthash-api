// backend/models/employeeModel.js
const db = require('../config/db');

/**
 * All tasks assigned to the given employee (with project name).
 */
// exports.getTasksAssignedToUser = async (companyId, firebaseUid) => {
//   const sql = `
//     SELECT 
//       t.id,
//       t.title,
//       t.description,
//       t.status,
//       t.priority,
//       t.due_date,
//       t.project_id,
//       t.deliverable_id,
//       p.name AS project_name,
//       GROUP_CONCAT(DISTINCT ta.employee_firebase_uid) AS assignee_ids
//     FROM tasks t
//     INNER JOIN task_assignees ta ON t.id = ta.task_id
//     LEFT JOIN projects p ON p.id = t.project_id
//     WHERE t.company_id = ?
//       AND EXISTS (
//         SELECT 1 
//         FROM task_assignees x 
//         WHERE x.task_id = t.id 
//           AND x.employee_firebase_uid = ?
//       )
//     GROUP BY t.id
//     ORDER BY t.created_at DESC
//   `;
//   const [rows] = await db.query(sql, [companyId, firebaseUid]);
//   return rows;
// };

// ✅ MODIFY the getTasksAssignedToUser function to include the voice_note_url
exports.getTasksAssignedToUser = async (companyId, firebaseUid) => {
  const sql = `
    SELECT 
      t.id,
      t.title,
      t.description,
      t.status,
      t.priority,
      t.due_date,
      COALESCE(t.project_id, d.project_id, d2.project_id) AS project_id,
      t.deliverable_id,
      t.deliverable_2_id,
      p.name AS project_name,
      t.voice_note_url  -- This line is added
    FROM tasks t
    INNER JOIN task_assignees ta ON t.id = ta.task_id
    LEFT JOIN deliverables d ON d.id = t.deliverable_id
    LEFT JOIN deliverables_2 d2 ON d2.id = t.deliverable_2_id
    LEFT JOIN projects p ON p.id = COALESCE(t.project_id, d.project_id, d2.project_id)
    WHERE t.company_id = ? AND ta.employee_firebase_uid = ?
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
      COALESCE(ad.assignedMinDate, pd.projectMinDate) AS minDate,
      COALESCE(ad.assignedMaxDate, pd.projectMaxDate) AS maxDate,
      ad.nextAssignedDate,
      CASE
        WHEN ad.assignedMinDate IS NOT NULL THEN ad.nextAssignedDate
        ELSE pd.nextProjectDate
      END AS nextDate,
      COALESCE(ad.assignedShoots, 0) AS assignedShoots,
      COALESCE(pd.shoots, 0) AS shoots,
      (SELECT COUNT(*) FROM deliverables d WHERE d.project_id = p.id) AS deliverablesTotal,
      (SELECT COUNT(*) FROM deliverables d WHERE d.project_id = p.id AND d.status = 'completed') AS deliverablesCompleted
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN (
      SELECT
        s.project_id,
        MIN(s.date) AS assignedMinDate,
        MAX(s.date) AS assignedMaxDate,
        MIN(CASE WHEN s.date >= CURDATE() THEN s.date END) AS nextAssignedDate,
        COUNT(DISTINCT s.id) AS assignedShoots
      FROM shoot_assignments sa
      JOIN shoots s ON s.id = sa.shoot_id
      WHERE sa.employee_firebase_uid = ?
      GROUP BY s.project_id
    ) ad ON ad.project_id = p.id
    LEFT JOIN (
      SELECT
        s.project_id,
        MIN(s.date) AS projectMinDate,
        MAX(s.date) AS projectMaxDate,
        MIN(CASE WHEN s.date >= CURDATE() THEN s.date END) AS nextProjectDate,
        COUNT(*) AS shoots
      FROM shoots s
      GROUP BY s.project_id
    ) pd ON pd.project_id = p.id
    WHERE p.company_id = ?
      AND p.id IN (
        -- via tasks
        SELECT DISTINCT COALESCE(t.project_id, d.project_id, d2.project_id) AS project_id
        FROM tasks t
        JOIN task_assignees ta ON ta.task_id = t.id
        LEFT JOIN deliverables d ON d.id = t.deliverable_id
        LEFT JOIN deliverables_2 d2 ON d2.id = t.deliverable_2_id
        WHERE t.company_id = ? 
          AND ta.employee_firebase_uid = ?
          AND COALESCE(t.project_id, d.project_id, d2.project_id) IS NOT NULL
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
  const params = [firebaseUid, companyId, companyId, firebaseUid, companyId, firebaseUid];
  const [rows] = await db.query(sql, params);
  return rows;
};

/**
 * Authorization helper: is employee assigned to the project?
 */
exports.isEmployeeAssignedToProject = async (companyId, projectId, firebaseUid) => {
  const sql = `
    SELECT 1 FROM tasks t
      LEFT JOIN deliverables d ON d.id = t.deliverable_id
      LEFT JOIN deliverables_2 d2 ON d2.id = t.deliverable_2_id
      JOIN task_assignees ta ON ta.task_id = t.id
      WHERE t.company_id = ?
        AND COALESCE(t.project_id, d.project_id, d2.project_id) = ?
        AND ta.employee_firebase_uid = ?
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
exports.getProjectDetailsView = async (companyId, projectId, firebaseUid) => {
  const [clientColumnRows] = await db.query('SHOW COLUMNS FROM clients');
  const clientColumns = new Set(clientColumnRows.map((column) => column.Field));
  const clientField = (field, alias) => (
    clientColumns.has(field) ? `c.${field} AS ${alias}` : `NULL AS ${alias}`
  );

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
      c.name                         AS clientName,
      ${clientField('phone', 'clientPhone')},
      ${clientField('email', 'clientEmail')},
      ${clientField('relation', 'clientRelation')},
      ${clientField('address', 'clientAddress')},
      ${clientField('notes', 'clientNotes')}
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    WHERE p.id = ? AND p.company_id = ?
    LIMIT 1
    `,
    [projectId, companyId]
  );

  const proj = projRows[0];
  if (!proj) return null;

  // Shoots/services assigned to this employee only.
  const [shootRows] = await db.query(
    `
    SELECT
      s.id,
      s.title,
      s.date,
      s.time,
      s.city,
      COALESCE(ser.name, sa.service_name) AS service_name,
      ss.quantity,
      sa.employee_firebase_uid,
      e.name AS employee_name
    FROM shoot_assignments sa
    JOIN shoots s ON s.id = sa.shoot_id
    LEFT JOIN services ser ON ser.name = sa.service_name
    LEFT JOIN shoot_services ss ON ss.shoot_id = s.id AND ss.service_id = ser.id
    LEFT JOIN employees e ON sa.employee_firebase_uid = e.firebase_uid
    WHERE s.project_id = ?
      AND sa.employee_firebase_uid = ?
    ORDER BY s.date ASC, s.time ASC
    `,
    [projectId, firebaseUid]
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

  const [deliv2Rows] = await db.query(
    `
    SELECT
      id,
      title,
      status,
      due_date AS date,
      created_at
    FROM deliverables_2
    WHERE project_id = ?
    ORDER BY created_at ASC
    `,
    [projectId]
  );

  const shootsById = {};
  for (const row of shootRows) {
    if (!shootsById[row.id]) {
      shootsById[row.id] = {
        id: row.id,
        title: row.title,
        date: row.date,
        time: row.time,
        city: row.city,
        selectedServices: {},
        assignments: {},
      };
    }

    if (row.service_name) {
      shootsById[row.id].selectedServices[row.service_name] = Number(row.quantity || 1);
      if (!shootsById[row.id].assignments[row.service_name]) {
        shootsById[row.id].assignments[row.service_name] = [];
      }
    }

    if (row.service_name && row.employee_name && !shootsById[row.id].assignments[row.service_name].includes(row.employee_name)) {
      shootsById[row.id].assignments[row.service_name].push(row.employee_name);
    }
  }

  // Shape response
  return {
    id: proj.id,
    projectName: proj.name,
    projectStatus: proj.status,
    projectPackageCost: Number(proj.packageCost || 0),
    deliverablesAdditionalCost: Number(proj.additionalCost || 0),
    overallTotalCost: Number(proj.totalCost || 0),
    clientName: proj.clientName,
    clientPhone: proj.clientPhone,
    clientEmail: proj.clientEmail,
    clientRelation: proj.clientRelation,
    clientAddress: proj.clientAddress,
    clientNotes: proj.clientNotes,
    clients: {
      clientDetails: {
        name: proj.clientName,
        phone: proj.clientPhone,
        email: proj.clientEmail,
        relation: proj.clientRelation,
        address: proj.clientAddress,
        notes: proj.clientNotes,
      },
    },

    shoots: {
      shootList: Object.values(shootsById),
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
    deliverables2: {
      deliverableItems: deliv2Rows.map(d => ({
        id: d.id,
        title: d.title,
        status: d.status,
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

// ✅ ADD THIS NEW MODEL FUNCTION
exports.updateTaskStatusAsEmployee = async (companyId, firebaseUid, taskId, newStatus) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Step 1: Security Check - Does this employee have rights to this task?
    const [taskRows] = await connection.query(
      `SELECT 1 FROM task_assignees WHERE task_id = ? AND employee_firebase_uid = ?`,
      [taskId, firebaseUid]
    );

    if (taskRows.length === 0) {
      throw new Error('Permission denied.'); // This will cause a rollback
    }

    // Step 2: Log this update in the new history table
    await connection.query(
      `INSERT INTO task_status_history (task_id, employee_firebase_uid, status_text) VALUES (?, ?, ?)`,
      [taskId, firebaseUid, newStatus]
    );

    // Step 3: Update the main `status` column in the `tasks` table
    await connection.query(
      `UPDATE tasks SET status = ? WHERE id = ? AND company_id = ?`,
      [newStatus, taskId, companyId]
    );

    // Step 4: If this is a custom status, add it to the reusable list (ignores duplicates)
    const predefined = ['to_do', 'in_progress', 'completed', 'rejected', 'finalize'];
    if (!predefined.includes(newStatus.toLowerCase().replace(' ', '_'))) {
        await connection.query(
            `INSERT IGNORE INTO custom_task_statuses (company_id, status_text) VALUES (?, ?)`,
            [companyId, newStatus]
        );
    }
    
    await connection.commit();
    return true; // Success

  } catch (err) {
    await connection.rollback();
    console.error("Transaction failed in updateTaskStatusAsEmployee:", err);
    return false; // Failure
  } finally {
    connection.release();
  }
};

// ✅ ADD THIS NEW MODEL FUNCTION
exports.getCustomTaskStatuses = async (companyId) => {
    const [rows] = await db.query(
        `SELECT status_text FROM custom_task_statuses WHERE company_id = ? ORDER BY created_at ASC`,
        [companyId]
    );
    // Return an array of strings
    return rows.map(r => r.status_text);
};
