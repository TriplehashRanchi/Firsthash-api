const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
// 1. Create or find client by phone + company_id
exports.findOrCreateClient = async (company_id, client) => {
  const { name, phone, relation, email } = client;

  const [existing] = await db.query(
    'SELECT id FROM clients WHERE company_id = ? AND phone = ?',
    [company_id, phone]
  );

  if (existing.length > 0) return existing[0].id;

  const client_id = uuidv4();

  const [result] = await db.query(
    `INSERT INTO clients (id, company_id, name, phone, relation, email) VALUES (?, ?, ?, ?, ?, ?)`,
    [client_id, company_id, name, phone, relation, email]
  );

  return client_id;
};

// 2. Save project main record
exports.createProject = async (company_id, name, costInfo, client_id) => {
  const project_id = uuidv4(); // ✅ generate UUID manually

  await db.query(
    `INSERT INTO projects (id, company_id, name, package_cost, additional_deliverables_cost, total_cost, client_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      project_id,
      company_id,
      name,
      costInfo.packageCost,
      costInfo.deliverablesCost,
      costInfo.totalCost,
      client_id,
    ]
  );

  return project_id; // ✅ must return this
};

// Helper to get service_id by name
const getServiceIdByName = async (name, company_id) => {
  const [rows] = await db.query(
    `SELECT id FROM services WHERE name = ? AND company_id = ? LIMIT 1`,
    [name, company_id]
  );
  return rows[0]?.id || null;
};

exports.insertShoots = async (project_id, shootsData = [], company_id) => {
  if (!project_id || !Array.isArray(shootsData)) return;

  console.log('Inserting shoots for project:', project_id)
  console.log('Company ID:', shootsData);

  for (const shoot of shootsData || []) {
    const { title, date, time, city, selectedServices = {} } = shoot;

    // 1. Insert shoot
    const [shootRes] = await db.query(
      `INSERT INTO shoots (project_id, title, date, time, city) VALUES (?, ?, ?, ?, ?)`,
      [project_id, title, date, time, city]
    );

    const shoot_id = shootRes.insertId;

    // 2. Insert shoot services with mapped service_id
    for (const serviceName in selectedServices) {
      const quantity = selectedServices[serviceName] || 1;
      const service_id = await getServiceIdByName(serviceName, company_id);

      if (service_id) {
        await db.query(
          `INSERT INTO shoot_services (shoot_id, service_id, quantity) VALUES (?, ?, ?)`,
          [shoot_id, service_id, quantity]
        );
      } else {
        console.warn(`⚠️ Service "${serviceName}" not found for company ${company_id}`);
      }
    }
  }
};

// 4. Save deliverables
exports.insertDeliverables = async (project_id, deliverables = []) => {
  for (const item of deliverables) {
    await db.query(
      `
       INSERT INTO deliverables
         (project_id, title, is_additional_charge, additional_charge_amount, estimated_date)
       VALUES (?, ?, ?, ?, ?)
      `,
      [
        project_id,
        item.title,
        item.isAdditionalCharge ? 1 : 0,
        item.additionalChargeAmount || 0,
        item.date || null
      ]
    );
  }
};

// 5. Save received amount
exports.insertReceivedAmount = async (project_id, transaction) => {
  // if there's nothing to insert, just return
  if (!transaction) return;

  await db.query(
    `INSERT INTO received_payments
       (project_id, amount, description, date_received)
     VALUES (?, ?, ?, ?)`,
    [
      project_id,
      transaction.amount || 0,
      transaction.description || null,
      transaction.date || null
    ]
  );
};


// 6. Save payment schedule
exports.insertPaymentSchedule = async (project_id, schedule = []) => {
  for (const { dueDate, amount, description } of schedule) {
    await db.query(
      `INSERT INTO payment_schedules (project_id, due_date, amount, description)
       VALUES (?, ?, ?, ?)`,
      [project_id, dueDate, amount, description || null]
    );
  }
};


exports.getAllProjectsWithDetails = async (company_id, statusFilter) => {
  let query = `
    SELECT
      p.id,
      p.name,
      p.status,
      p.package_cost AS "packageCost",
      p.additional_deliverables_cost AS "additionalCost",
      c.name AS "clientName",
      
      -- Your Insight Implemented Here: Get MIN and MAX shoot dates --
      (SELECT MIN(date) FROM shoots WHERE shoots.project_id = p.id) AS "minDate",
      (SELECT MAX(date) FROM shoots WHERE shoots.project_id = p.id) AS "maxDate",
      
      -- Subquery to count shoots for this project
      (SELECT COUNT(*) FROM shoots WHERE shoots.project_id = p.id) AS "shoots",
      
      -- Subquery to count total deliverables
      (SELECT COUNT(*) FROM deliverables WHERE deliverables.project_id = p.id) AS "deliverablesTotal",
      
      -- Subquery to count COMPLETED deliverables
      (SELECT COUNT(*) FROM deliverables WHERE deliverables.project_id = p.id AND deliverables.status = 'completed') AS "deliverablesCompleted",
      
      -- Hardcoding tasks to 0 until the feature is built
      0 AS "tasks"
      
    FROM
      projects AS p
    JOIN
      clients AS c ON p.client_id = c.id
    WHERE
      p.company_id = ?
  `;

  const queryParams = [company_id];

  // If a status filter is provided (and not 'all'), add it to the query
  if (statusFilter && statusFilter !== 'all') {
    query += ` AND p.status = ?`;
    queryParams.push(statusFilter);
  }

  query += ` ORDER BY p.created_at DESC;`;

  const [rows] = await db.query(query, queryParams);
  return rows;
};


exports.getProjectDetailsById = async (projectUuid, companyId) => {
    // 1. Define all the parallel queries.
    
    // Core project and client info
    const projectQuery = db.query(`
        SELECT 
            p.id, p.name AS "projectName", p.status AS "projectStatus",
            p.package_cost AS "projectPackageCost", 
            p.additional_deliverables_cost AS "deliverablesAdditionalCost",
            p.total_cost AS "overallTotalCost",
            c.name AS "clientName", c.phone AS "clientPhone", c.relation AS "clientRelation", c.email AS "clientEmail"
        FROM projects AS p JOIN clients AS c ON p.client_id = c.id
        WHERE p.id = ? AND p.company_id = ?
    `, [projectUuid, companyId]);

    // Get shoots and their direct assignments
     const shootsQuery = db.query(`
        SELECT 
            s.id, s.title, s.date, s.time, s.city, -- Shoot details
            ser.name AS service_name,              -- The service name (e.g., "Candid Photography")
            ss.quantity,                           -- The required count for that service
            sa.employee_firebase_uid,              -- The assigned employee's ID
            e.name AS employee_name                -- The assigned employee's name
        FROM shoots s
        LEFT JOIN shoot_services ss ON s.id = ss.shoot_id
        LEFT JOIN services ser ON ss.service_id = ser.id
        LEFT JOIN shoot_assignments sa ON s.id = sa.shoot_id AND ser.name = sa.service_name
        LEFT JOIN employees e ON sa.employee_firebase_uid = e.firebase_uid
        WHERE s.project_id = ?
    `, [projectUuid]);
    
    // Get simple list of deliverables
    const deliverablesQuery = db.query('SELECT * FROM deliverables WHERE project_id = ?', [projectUuid]);

    // Get all tasks (project-level and deliverable-level) and their assignees
    const tasksQuery = db.query(`
        SELECT t.*, ta.employee_firebase_uid, e.name as employee_name
        FROM tasks t
        LEFT JOIN task_assignees ta ON t.id = ta.task_id
        LEFT JOIN employees e ON ta.employee_firebase_uid = e.firebase_uid
        WHERE t.project_id = ? OR t.deliverable_id IN (SELECT id FROM deliverables WHERE project_id = ?)
    `, [projectUuid, projectUuid]);
    
    // Financials
    const receivedPaymentsQuery = db.query('SELECT * FROM received_payments WHERE project_id = ? ORDER BY date_received DESC', [projectUuid]);
    const paymentScheduleQuery = db.query('SELECT * FROM payment_schedules WHERE project_id = ? ORDER BY due_date ASC', [projectUuid]);
    const expensesQuery = db.query('SELECT * FROM expenses WHERE project_id = ? ORDER BY expense_date DESC', [projectUuid]);
    
   const teamQuery = db.query(`
        SELECT
            e.firebase_uid AS id,
            e.name,
            IFNULL(GROUP_CONCAT(er.type_name), '') AS roles,
            (SELECT er_inner.type_name FROM employee_roles er_inner JOIN employee_role_assignments era_inner ON er_inner.id = era_inner.role_id WHERE era_inner.firebase_uid = e.firebase_uid LIMIT 1) AS primaryRole
        FROM
            employees e
        LEFT JOIN
            employee_role_assignments era ON e.firebase_uid = era.firebase_uid
        LEFT JOIN
            employee_roles er ON era.role_id = er.id
        WHERE
            e.company_id = ?
        GROUP BY
            e.firebase_uid, e.name
    `, [companyId]);

    // 2. Execute all queries at once.
    const [
        [projectResults], [shootRows], [deliverables], [taskAssignmentRows], 
        [receivedPayments], [paymentSchedules], [expenses], [teamMembers]
    ] = await Promise.all([
        projectQuery, shootsQuery, deliverablesQuery, tasksQuery,
        receivedPaymentsQuery, paymentScheduleQuery, expensesQuery, teamQuery
    ]);

    // 3. If no project, stop here.
    const projectData = projectResults[0];
    if (!projectData) return null;

    // 4. Process the raw database results into the nested JSON the frontend needs.

    // Process shoot assignments
    const shootsById = {};
    for (const row of shootRows) {
        // If we haven't seen this shoot ID before, initialize it.
        if (!shootsById[row.id]) {
            shootsById[row.id] = {
                id: row.id,
                title: row.title,
                date: row.date,
                time: row.time,
                city: row.city,
                selectedServices: {}, // Initialize the crucial requirements object
                assignments: {}       // Initialize the assignments object
            };
        }
        
        // Populate the selectedServices (requirements)
        if (row.service_name && row.quantity) {
            shootsById[row.id].selectedServices[row.service_name] = row.quantity;
        }

        // Populate the assignments for that service
        if (row.service_name && row.employee_name) {
            if (!shootsById[row.id].assignments[row.service_name]) {
                shootsById[row.id].assignments[row.service_name] = [];
            }
            // Avoid adding duplicate names if a bug causes multiple rows
            if (!shootsById[row.id].assignments[row.service_name].includes(row.employee_name)) {
                shootsById[row.id].assignments[row.service_name].push(row.employee_name);
            }
        }
    }

    // Process tasks and their assignments
    const tasksById = {};
    for (const row of taskAssignmentRows) {
        if (!tasksById[row.id]) {
            tasksById[row.id] = { ...row, assignments: [] }; // All tasks have an assignments array
            delete tasksById[row.id].employee_firebase_uid;
            delete tasksById[row.id].employee_name;
        }
        if (row.employee_name) {
            tasksById[row.id].assignments.push(row.employee_name);
        }
    }

    // 5. Assemble the final, complete object.
    return {
        ...projectData,
        teamMembers,
        clients: {
            clientDetails: {
                name: projectData.clientName, phone: projectData.clientPhone,
                relation: projectData.clientRelation, email: projectData.clientEmail,
            }
        },
        shoots: { shootList: Object.values(shootsById) },
        deliverables: { deliverableItems: deliverables.map(d => ({...d, additional_charge_amount: parseFloat(d.additional_charge_amount)})) },
        tasks: Object.values(tasksById), // A flat list of all tasks for this project
        receivedAmount: { transactions: receivedPayments.map(p => ({ ...p, amount: parseFloat(p.amount) })) },
        paymentSchedule: { paymentInstallments: paymentSchedules.map(p => ({ ...p, amount: parseFloat(p.amount) })) },
        expenses: expenses.map(e => ({ id: e.id, productName: e.description, category: e.category, expense: parseFloat(e.amount), date: e.expense_date }))
    };
};