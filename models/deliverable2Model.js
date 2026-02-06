const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const getBundleByIdInternal = async (bundleId, companyId, connection) => {
  const [[bundle]] = await connection.query(
    `SELECT id, name, is_active FROM task_bundles WHERE id = ? AND company_id = ?`,
    [bundleId, companyId]
  );

  return bundle || null;
};

exports.importBundleToDeliverable2 = async ({
  companyId,
  projectId,
  bundleId,
  deliverableTitle,
  dueDate = null,
}) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[project]] = await connection.query(
      `SELECT id FROM projects WHERE id = ? AND company_id = ?`,
      [projectId, companyId]
    );
    if (!project) throw new Error('Project not found');

    const bundle = await getBundleByIdInternal(bundleId, companyId, connection);
    if (!bundle) throw new Error('Bundle not found');
    if (!bundle.is_active) throw new Error('Bundle is inactive');

    const title = (deliverableTitle || bundle.name || '').trim();
    if (!title) throw new Error('Deliverable title is required');

    const [deliverableResult] = await connection.query(
      `
        INSERT INTO deliverables_2 (project_id, title, due_date, status)
        VALUES (?, ?, ?, 'pending')
      `,
      [projectId, title, dueDate]
    );

    const deliverable2Id = deliverableResult.insertId;

    const [[deliverable2]] = await connection.query(
      `SELECT * FROM deliverables_2 WHERE id = ?`,
      [deliverable2Id]
    );

    const [bundleItems] = await connection.query(
      `
        SELECT id, parent_item_id, title, description, priority, sort_order
        FROM task_bundle_items
        WHERE bundle_id = ?
        ORDER BY sort_order ASC, id ASC
      `,
      [bundleId]
    );

    if (!bundleItems.length) {
      await connection.commit();
      return { deliverable2, createdCount: 0 };
    }

    const itemToTask = new Map();
    const pending = [...bundleItems];
    let createdCount = 0;

    while (pending.length) {
      let progressed = false;

      for (let i = pending.length - 1; i >= 0; i -= 1) {
        const item = pending[i];
        const hasParent = !!item.parent_item_id;

        if (hasParent && !itemToTask.has(item.parent_item_id)) {
          continue;
        }

        const taskId = uuidv4();
        const parentTaskId = hasParent ? itemToTask.get(item.parent_item_id) : null;

        await connection.query(
          `
            INSERT INTO tasks (
              id, company_id, deliverable_2_id, parent_task_id,
              title, description, priority, due_date, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'to_do')
          `,
          [
            taskId,
            companyId,
            deliverable2Id,
            parentTaskId,
            item.title,
            item.description,
            item.priority || 'medium',
            null,
          ]
        );

        itemToTask.set(item.id, taskId);
        createdCount += 1;
        pending.splice(i, 1);
        progressed = true;
      }

      if (!progressed) {
        throw new Error('Invalid bundle item hierarchy');
      }
    }

    await connection.commit();
    return { deliverable2, createdCount };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

exports.updateDeliverable2DueDate = async ({
  companyId,
  deliverable2Id,
  dueDate,
}) => {
  const [result] = await db.query(
    `
      UPDATE deliverables_2 d
      JOIN projects p ON p.id = d.project_id
      SET d.due_date = ?
      WHERE d.id = ? AND p.company_id = ?
    `,
    [dueDate, deliverable2Id, companyId]
  );

  if (!result.affectedRows) return null;

  const [[deliverable2]] = await db.query(
    `SELECT * FROM deliverables_2 WHERE id = ?`,
    [deliverable2Id]
  );

  return deliverable2;
};
