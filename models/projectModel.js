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
  console.log('Shoots data:', shootsData);

  for (const shoot of shootsData || []) {
    const { title, date, time, city, selectedServices = {} } = shoot;

    // 1. Insert shoot
    const [shootRes] = await db.query(
      `INSERT INTO shoots (project_id, title, date, time, city) VALUES (?, ?, ?, ?, ?)`,
      [project_id, title, date, time, city]
    );

    const shoot_id = shootRes.insertId;

    // 2. Insert shoot services
    for (const serviceName in selectedServices) {
      const quantity = selectedServices[serviceName] || 1;
      let service_id = await getServiceIdByName(serviceName, company_id);

      // If service not found, insert it
      if (!service_id) {
        console.log(`ℹ️ Service "${serviceName}" not found. Inserting new service for company ${company_id}...`);

        const [insertServiceRes] = await db.query(
          `INSERT INTO services (company_id, name) VALUES (?, ?)`,
          [company_id, serviceName]
        );

        service_id = insertServiceRes.insertId;
      }

      // Now insert into shoot_services
      await db.query(
        `INSERT INTO shoot_services (shoot_id, service_id, quantity) VALUES (?, ?, ?)`,
        [shoot_id, service_id, quantity]
      );
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
        WHERE t.company_id = ? AND (t.project_id = ? OR t.deliverable_id IN (SELECT id FROM deliverables WHERE project_id = ?))
    `, [companyId, projectUuid, projectUuid]);
    
    // Financials
    const receivedPaymentsQuery = db.query('SELECT * FROM received_payments WHERE project_id = ? ORDER BY date_received DESC', [projectUuid]);
    const paymentScheduleQuery = db.query('SELECT * FROM payment_schedules WHERE project_id = ? ORDER BY due_date ASC', [projectUuid]);
    const expensesQuery = db.query('SELECT * FROM expenses WHERE project_id = ? ORDER BY expense_date DESC', [projectUuid]);
    
      const teamRolesQuery = db.query(`
        SELECT
            e.firebase_uid,
            e.name AS employee_name,
            er.type_name AS role,
            er.role_code
        FROM
            employees e
        INNER JOIN
            employee_role_assignments era ON e.firebase_uid = era.firebase_uid
        INNER JOIN
            employee_roles er ON era.role_id = er.id
        WHERE
            e.company_id = ?
            AND (er.company_id = e.company_id OR er.company_id = '00000000-0000-0000-0000-000000000000');
    `, [companyId]);

       const allEmployeesQuery = db.query('SELECT firebase_uid AS id, name FROM employees WHERE company_id = ?', [companyId]);

        const quotationsQuery = db.query(
        'SELECT * FROM quotations WHERE project_id = ? ORDER BY version DESC',
        [projectUuid]
    );

    // 2. Execute all queries at once.
    const [
        [projectResults], [shootRows], [deliverables], [taskAssignmentRows], 
        [receivedPayments], [paymentSchedules], [expenses], [teamRoleRows], [allEmployees], [quotations]
    ] = await Promise.all([
        projectQuery, shootsQuery, deliverablesQuery, tasksQuery,
        receivedPaymentsQuery, paymentScheduleQuery, expensesQuery, teamRolesQuery, allEmployeesQuery, quotationsQuery 
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
 // 4. Process all the data in JavaScript.
    const teamMembersById = new Map(allEmployees.map(emp => [emp.id, { ...emp, primaryRole: null, roles: [] }]));

    for (const row of teamRoleRows) {
        const employee = teamMembersById.get(row.firebase_uid);
        if (employee) {
            if (!employee.primaryRole) {
                employee.primaryRole = row.role;
            }
            employee.roles.push({
                role: row.role,
                code: row.role_code
            });
        }
    }
    const teamMembers = Array.from(teamMembersById.values());


    // 5. Assemble the final, complete object.
    return {
        ...projectData,
        teamMembers,
        quotations,
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

/**

    Updates the status of a specific project.

    @param {string} projectId - The UUID of the project to update.

    @param {string} newStatus - The new status to set (e.g., 'ongoing', 'completed').

    @returns {Promise<object>} The result object from the database driver.
    */
    exports.updateStatusById = async (projectId, newStatus) => {
    const [result] = await db.query(`
    UPDATE projects SET status = ? WHERE id = ?`,
    [newStatus, projectId]
    );
    return result;
    };


// --- REPLACE your existing function with this FINAL, CORRECTED version ---
// File: models/projectModel.js

// ... (keep the rest of your file the same) ...

exports.fetchDataForAllocationCalendar = async (company_id) => {
    // 1. We run four queries in parallel.
    
    // Query A: Get all shoots for ongoing projects (NO CHANGE HERE)
    const shootsQuery = db.query(`
        SELECT 
            s.id, s.title, s.date, s.time, s.city,
            p.name AS projectName,
            c.name AS clientName
        FROM projects p
        LEFT JOIN shoots s ON p.id = s.project_id
        LEFT JOIN clients c ON p.client_id = c.id
        WHERE p.company_id = ? AND p.status = 'ongoing' AND s.id IS NOT NULL
    `, [company_id]);

    // Query B: Get all allocations for those shoots (NO CHANGE HERE)
    const allocationsQuery = db.query(`
        SELECT 
            ssa.shoot_id, ssa.service_name, ss.quantity, ssa.employee_firebase_uid
        FROM shoot_assignments ssa
        LEFT JOIN shoot_services ss ON ssa.shoot_id = ss.shoot_id AND ssa.service_name = (SELECT name FROM services WHERE id = ss.service_id)
        WHERE ssa.shoot_id IN (SELECT id FROM shoots WHERE project_id IN (SELECT id FROM projects WHERE company_id = ? AND status = 'ongoing'))
        UNION
        SELECT 
            ss.shoot_id, ser.name as service_name, ss.quantity, ssa.employee_firebase_uid
        FROM shoot_services ss
        JOIN services ser ON ss.service_id = ser.id
        LEFT JOIN shoot_assignments ssa ON ss.shoot_id = ssa.shoot_id AND ser.name = ssa.service_name
        WHERE ss.shoot_id IN (SELECT id FROM shoots WHERE project_id IN (SELECT id FROM projects WHERE company_id = ? AND status = 'ongoing'))
    `, [company_id, company_id]);

    // --- START: MODIFICATION 1 ---
    // Query C: Get team members AND ONLY their 'On-Production' roles.
    // We also filter to only include members who have at least one 'On-Production' role.
    const teamMembersQuery = db.query(`
        SELECT 
            e.firebase_uid AS id, 
            e.name,
            -- This now ONLY aggregates roles where role_code is 1
            JSON_ARRAYAGG(CASE WHEN er.role_code = 1 THEN er.type_name ELSE NULL END) AS roles
        FROM employees e
        LEFT JOIN employee_role_assignments era ON e.firebase_uid = era.firebase_uid
        LEFT JOIN employee_roles er ON era.role_id = er.id
        WHERE e.company_id = ?
        -- This ensures we only get employees who have at least ONE 'On-Production' role
        AND EXISTS (
            SELECT 1
            FROM employee_role_assignments sub_era
            JOIN employee_roles sub_er ON sub_era.role_id = sub_er.id
            WHERE sub_era.firebase_uid = e.firebase_uid AND sub_er.role_code = 1
        )
        GROUP BY e.firebase_uid, e.name
    `, [company_id]);
    // --- END: MODIFICATION 1 ---

    // --- START: MODIFICATION 2 ---
    // Query D: Get a simple list of available roles that are designated as 'On-Production'.
    const rolesQuery = db.query(
        `SELECT DISTINCT er.type_name FROM employee_roles er 
         WHERE (er.company_id = ? OR er.company_id = '00000000-0000-0000-0000-000000000000')
         AND er.role_code = 1`, // The filter is added here
        [company_id]
    );
    // --- END: MODIFICATION 2 ---
    
    // 2. Execute all queries at once.
    const [[shoots], [allocations], [teamMembers], [roleRows]] = await Promise.all([
        shootsQuery, allocationsQuery, teamMembersQuery, rolesQuery
    ]);
    
    // 3. Process the data into the final structure (NO CHANGE HERE)
    const shootsById = shoots.reduce((acc, shoot) => {
        acc[shoot.id] = {
            id: shoot.id, eventDate: shoot.date, clientName: shoot.clientName,
            functionName: shoot.title, location: shoot.city, allocations: {}
        };
        return acc;
    }, {});

    for (const alloc of allocations) {
        if (shootsById[alloc.shoot_id]) {
            const service = alloc.service_name;
            if (!shootsById[alloc.shoot_id].allocations[service]) {
                shootsById[alloc.shoot_id].allocations[service] = { required: alloc.quantity || 1, assigned: [] };
            }
            if (alloc.employee_firebase_uid && !shootsById[alloc.shoot_id].allocations[service].assigned.includes(alloc.employee_firebase_uid)) {
                shootsById[alloc.shoot_id].allocations[service].assigned.push(alloc.employee_firebase_uid);
            }
        }
    }
    
    // 4. Return everything in one clean object, ensuring team member roles are properly parsed. (NO CHANGE HERE)
    return {
        shoots: Object.values(shootsById),
        teamMembers: teamMembers.map(member => {
            let parsedRoles = [];
            try {
                // This will correctly filter out the NULLs we introduced in the SQL query
                const rolesFromString = JSON.parse(member.roles);
                if (Array.isArray(rolesFromString)) {
                    parsedRoles = rolesFromString.filter(role => role !== null);
                }
            } catch (e) {
                parsedRoles = [];
            }
            return { ...member, roles: parsedRoles };
        }),
        roles: roleRows.map(r => r.type_name)
    };
};

exports.updateFullProject = async (projectId, companyId, projectData) => {
  const connection = await db.getConnection();

  // --- helper to safely parse currency/number strings ---
  const toNumber = (v) => {
    if (v === null || v === undefined) return 0;
    const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  try {
    await connection.beginTransaction();

    // --- CLIENT UPDATE (unchanged) ---
    const { clients } = projectData;
    if (!clients || !clients.clientDetails || !clients.clientDetails.phone) {
      throw new Error('Client details with a phone number are required for an update.');
    }
    const newClientDetails = clients.clientDetails;

    const [[currentProject]] = await connection.query(
      'SELECT client_id FROM projects WHERE id = ? AND company_id = ?',
      [projectId, companyId]
    );
    if (!currentProject) throw new Error('Project not found or does not belong to this company.');

    const currentClientId = currentProject.client_id;
    const [[currentClient]] = await connection.query(
      'SELECT phone FROM clients WHERE id = ?',
      [currentClientId]
    );

    let finalClientId = currentClientId;

    if (currentClient.phone !== newClientDetails.phone) {
      finalClientId = await exports.findOrCreateClient(companyId, newClientDetails);
    } else {
      await connection.query(
        `UPDATE clients SET name = ?, relation = ?, email = ? WHERE id = ? AND company_id = ?`,
        [
          newClientDetails.name,
          newClientDetails.relation,
          newClientDetails.email,
          currentClientId,
          companyId,
        ]
      );
    }

    // --- DELETE children (unchanged) ---
    await connection.query(
      'DELETE FROM shoot_services WHERE shoot_id IN (SELECT id FROM shoots WHERE project_id = ?)',
      [projectId]
    );
    await connection.query('DELETE FROM shoots WHERE project_id = ?', [projectId]);
    await connection.query('DELETE FROM deliverables WHERE project_id = ?', [projectId]);
    await connection.query('DELETE FROM received_payments WHERE project_id = ?', [projectId]);
    await connection.query('DELETE FROM payment_schedules WHERE project_id = ?', [projectId]);

    // --- READ core fields from payload ---
    const {
      projectName,
      projectPackageCost,             // may be "8446.00" (string)
      deliverablesAdditionalCost,     // may be string OR omitted
      // overallTotalCost,            // <-- ignore this; we recompute server-side
    } = projectData;

    // --- Recompute additional_deliverables_cost from deliverables list if present ---
    const items = projectData?.deliverables?.deliverableItems || [];
    const addlFromItems = items.reduce((sum, it) => {
      if (it?.isAdditionalCharge) return sum + toNumber(it.additionalChargeAmount);
      return sum;
    }, 0);

    // prefer explicit field if sent, else derive from items
    const pkgCost = toNumber(projectPackageCost);
    const addlCost =
      deliverablesAdditionalCost !== undefined && deliverablesAdditionalCost !== null
        ? toNumber(deliverablesAdditionalCost)
        : addlFromItems;

    const totalCost = Number((pkgCost + addlCost).toFixed(2));

    // --- UPDATE main project with recomputed totals ---
    await connection.query(
      `UPDATE projects SET 
         name = ?, 
         package_cost = ?, 
         additional_deliverables_cost = ?, 
         total_cost = ?,
         client_id = ?
       WHERE id = ? AND company_id = ?`,
      [
        projectName,
        pkgCost,
        addlCost,
        totalCost,         // ← recomputed; do NOT use client overallTotalCost
        finalClientId,
        projectId,
        companyId,
      ]
    );

    // --- RE-INSERT Shoots ---
    if (projectData.shoots?.shootList) {
      for (const shoot of projectData.shoots.shootList) {
        const { title, date, time, city, selectedServices = {} } = shoot;
        const [shootRes] = await connection.query(
          `INSERT INTO shoots (project_id, title, date, time, city) VALUES (?, ?, ?, ?, ?)`,
          [projectId, title, date || null, time || null, city || null]
        );
        const shoot_id = shootRes.insertId;
        for (const serviceName in selectedServices) {
          const quantity = selectedServices[serviceName] || 1;
          const service_id = await getServiceIdByName(serviceName, companyId);
          if (service_id) {
            await connection.query(
              `INSERT INTO shoot_services (shoot_id, service_id, quantity) VALUES (?, ?, ?)`,
              [shoot_id, service_id, quantity]
            );
          }
        }
      }
    }

    // --- RE-INSERT Deliverables ---
    if (items.length) {
      for (const item of items) {
        await connection.query(
          `INSERT INTO deliverables (project_id, title, is_additional_charge, additional_charge_amount, estimated_date)
           VALUES (?, ?, ?, ?, ?)`,
          [
            projectId,
            item.title,
            item.isAdditionalCharge ? 1 : 0,
            toNumber(item.additionalChargeAmount),
            item.date || null,
          ]
        );
      }
    }

    // --- RE-INSERT Received Payments ---
    if (projectData.receivedAmount?.transactions) {
      for (const tx of projectData.receivedAmount.transactions) {
        if (!tx) continue;
        await connection.query(
          `INSERT INTO received_payments (project_id, amount, description, date_received)
           VALUES (?, ?, ?, ?)`,
          [projectId, toNumber(tx.amount), tx.description || null, tx.date || null]
        );
      }
    }

    // --- RE-INSERT Payment Schedule ---
    if (projectData.paymentSchedule?.paymentInstallments) {
      for (const { dueDate, amount, description } of projectData.paymentSchedule.paymentInstallments) {
        await connection.query(
          `INSERT INTO payment_schedules (project_id, due_date, amount, description)
           VALUES (?, ?, ?, ?)`,
          [projectId, dueDate || null, toNumber(amount), description || null]
        );
      }
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    console.error('DATABASE TRANSACTION FAILED:', err);
    throw err;
  } finally {
    connection.release();
  }
};


// models/shootModel.js
exports.updateShootCity = async (shootId, companyId, { city, date, time }) => {
  const [[row]] = await db.query(
    `SELECT s.id
       FROM shoots s
       JOIN projects p ON p.id = s.project_id
      WHERE s.id = ? AND p.company_id = ?`,
    [shootId, companyId]
  );

  if (!row) throw new Error('Shoot not found or not in this company');

  const fields = [];
  const values = [];

  if (city !== undefined) {
    fields.push('city = ?');
    values.push(city || null);
  }

  if (date !== undefined) {
    fields.push('date = ?');
    values.push(date || null);
  }

  if (time !== undefined) {
    fields.push('time = ?');
    values.push(time || null);
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(shootId);

  await db.query(
    `UPDATE shoots SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  // 🚀 return raw DB values (same as project fetch)
  const [[updated]] = await db.query(
    `SELECT s.id, s.title, s.date, s.time, s.city
     FROM shoots s
     WHERE s.id = ?`,
    [shootId]
  );

  return { message: 'Shoot updated successfully', shoot: updated };
};



exports.deleteProject = async (projectId, companyId) => {
  const [result] = await db.query(
    `DELETE FROM projects WHERE id = ? AND company_id = ?`,
    [projectId, companyId]
  );
  return result; // contains affectedRows
};
