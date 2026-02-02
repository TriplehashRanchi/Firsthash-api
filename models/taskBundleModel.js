const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const normalizeTitle = (value = '') => value.trim().toLowerCase();

const getBundleByIdInternal = async (bundleId, companyId) => {
  const [[bundle]] = await db.query(
    `SELECT * FROM task_bundles WHERE id = ? AND company_id = ?`,
    [bundleId, companyId]
  );

  return bundle || null;
};

exports.getBundlesByCompany = async (companyId) => {
  const [rows] = await db.query(
    `
      SELECT
        b.id,
        b.company_id,
        b.name,
        b.description,
        b.is_active,
        b.created_at,
        b.updated_at,
        COUNT(i.id) AS items_count
      FROM task_bundles b
      LEFT JOIN task_bundle_items i ON i.bundle_id = b.id
      WHERE b.company_id = ?
      GROUP BY b.id
      ORDER BY b.updated_at DESC
    `,
    [companyId]
  );

  return rows;
};

exports.createBundle = async (companyId, payload) => {
  const { name, description = null, is_active = 1 } = payload;
  const [result] = await db.query(
    `
      INSERT INTO task_bundles (company_id, name, description, is_active)
      VALUES (?, ?, ?, ?)
    `,
    [companyId, name.trim(), description, is_active ? 1 : 0]
  );

  const [[bundle]] = await db.query(
    `SELECT * FROM task_bundles WHERE id = ? AND company_id = ?`,
    [result.insertId, companyId]
  );

  return bundle;
};

exports.updateBundle = async (bundleId, companyId, payload) => {
  const fields = ['name', 'description', 'is_active'];
  const clauses = [];
  const values = [];

  for (const field of fields) {
    if (payload[field] !== undefined) {
      clauses.push(`${field} = ?`);
      if (field === 'name') values.push(String(payload[field]).trim());
      else if (field === 'is_active') values.push(payload[field] ? 1 : 0);
      else values.push(payload[field]);
    }
  }

  if (!clauses.length) return null;

  values.push(bundleId, companyId);

  const [result] = await db.query(
    `UPDATE task_bundles SET ${clauses.join(', ')} WHERE id = ? AND company_id = ?`,
    values
  );

  if (!result.affectedRows) return null;

  const [[bundle]] = await db.query(
    `SELECT * FROM task_bundles WHERE id = ? AND company_id = ?`,
    [bundleId, companyId]
  );

  return bundle;
};

exports.deleteBundle = async (bundleId, companyId) => {
  const [result] = await db.query(
    `DELETE FROM task_bundles WHERE id = ? AND company_id = ?`,
    [bundleId, companyId]
  );
  return result.affectedRows > 0;
};

exports.getBundleById = async (bundleId, companyId) => {
  return getBundleByIdInternal(bundleId, companyId);
};

exports.getBundleItems = async (bundleId, companyId) => {
  const [rows] = await db.query(
    `
      SELECT i.*
      FROM task_bundle_items i
      JOIN task_bundles b ON b.id = i.bundle_id
      WHERE i.bundle_id = ? AND b.company_id = ?
      ORDER BY i.sort_order ASC, i.id ASC
    `,
    [bundleId, companyId]
  );

  return rows;
};

exports.addBundleItem = async (bundleId, companyId, payload) => {
  const bundle = await getBundleByIdInternal(bundleId, companyId);
  if (!bundle) return null;

  const {
    parent_item_id = null,
    title,
    description = null,
    priority = 'medium',
    due_in_days = null,
    sort_order = 0,
  } = payload;

  if (parent_item_id) {
    const [[parent]] = await db.query(
      `SELECT id FROM task_bundle_items WHERE id = ? AND bundle_id = ?`,
      [parent_item_id, bundleId]
    );
    if (!parent) {
      throw new Error('Parent item not found in this bundle');
    }
  }

  const [result] = await db.query(
    `
      INSERT INTO task_bundle_items (
        bundle_id, parent_item_id, title, description, priority, due_in_days, sort_order
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      bundleId,
      parent_item_id,
      title.trim(),
      description,
      priority,
      due_in_days,
      sort_order,
    ]
  );

  const [[item]] = await db.query(
    `SELECT * FROM task_bundle_items WHERE id = ? AND bundle_id = ?`,
    [result.insertId, bundleId]
  );

  return item;
};

exports.updateBundleItem = async (bundleId, itemId, companyId, payload) => {
  const bundle = await getBundleByIdInternal(bundleId, companyId);
  if (!bundle) return null;

  const fields = [
    'parent_item_id',
    'title',
    'description',
    'priority',
    'due_in_days',
    'sort_order',
  ];
  const clauses = [];
  const values = [];

  for (const field of fields) {
    if (payload[field] !== undefined) {
      clauses.push(`${field} = ?`);
      if (field === 'title') values.push(String(payload[field]).trim());
      else values.push(payload[field]);
    }
  }

  if (!clauses.length) return null;

  if (payload.parent_item_id) {
    if (Number(payload.parent_item_id) === Number(itemId)) {
      throw new Error('Item cannot be parent of itself');
    }
    const [[parent]] = await db.query(
      `SELECT id FROM task_bundle_items WHERE id = ? AND bundle_id = ?`,
      [payload.parent_item_id, bundleId]
    );
    if (!parent) throw new Error('Parent item not found in this bundle');
  }

  values.push(itemId, bundleId);
  const [result] = await db.query(
    `UPDATE task_bundle_items SET ${clauses.join(', ')} WHERE id = ? AND bundle_id = ?`,
    values
  );

  if (!result.affectedRows) return null;

  const [[item]] = await db.query(
    `SELECT * FROM task_bundle_items WHERE id = ? AND bundle_id = ?`,
    [itemId, bundleId]
  );

  return item;
};

exports.deleteBundleItem = async (bundleId, itemId, companyId) => {
  const bundle = await getBundleByIdInternal(bundleId, companyId);
  if (!bundle) return false;

  const [result] = await db.query(
    `DELETE FROM task_bundle_items WHERE id = ? AND bundle_id = ?`,
    [itemId, bundleId]
  );
  return result.affectedRows > 0;
};

const computeDueDate = (baseDate, dueInDays) => {
  if (dueInDays === null || dueInDays === undefined || dueInDays === '') return null;
  const days = Number(dueInDays);
  if (Number.isNaN(days)) return null;
  const dt = new Date(baseDate);
  dt.setDate(dt.getDate() + days);
  return dt;
};

exports.importBundleToDeliverable = async ({
  companyId,
  deliverableId,
  bundleId,
  dueBaseDate,
  skipDuplicates = true,
}) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[bundle]] = await connection.query(
      `SELECT id, is_active FROM task_bundles WHERE id = ? AND company_id = ?`,
      [bundleId, companyId]
    );
    if (!bundle) throw new Error('Bundle not found');
    if (!bundle.is_active) throw new Error('Bundle is inactive');

    const [[deliverable]] = await connection.query(
      `
        SELECT d.id, d.project_id
        FROM deliverables d
        JOIN projects p ON p.id = d.project_id
        WHERE d.id = ? AND p.company_id = ?
      `,
      [deliverableId, companyId]
    );
    if (!deliverable) throw new Error('Deliverable not found');

    const [bundleItems] = await connection.query(
      `
        SELECT id, parent_item_id, title, description, priority, due_in_days, sort_order
        FROM task_bundle_items
        WHERE bundle_id = ?
        ORDER BY sort_order ASC, id ASC
      `,
      [bundleId]
    );

    if (!bundleItems.length) {
      await connection.commit();
      return { createdCount: 0, skippedCount: 0 };
    }

    const existingTitleSet = new Set();
    if (skipDuplicates) {
      const [existingRows] = await connection.query(
        `SELECT title FROM tasks WHERE deliverable_id = ?`,
        [deliverableId]
      );
      for (const row of existingRows) {
        existingTitleSet.add(normalizeTitle(row.title));
      }
    }

    const itemToTask = new Map();
    const pending = [...bundleItems];
    let createdCount = 0;
    let skippedCount = 0;
    const baseDate = dueBaseDate ? new Date(dueBaseDate) : new Date();

    while (pending.length) {
      let progressed = false;

      for (let i = pending.length - 1; i >= 0; i -= 1) {
        const item = pending[i];
        const hasParent = !!item.parent_item_id;

        if (hasParent && !itemToTask.has(item.parent_item_id)) {
          continue;
        }

        const normalized = normalizeTitle(item.title);
        if (!hasParent && skipDuplicates && existingTitleSet.has(normalized)) {
          skippedCount += 1;
          pending.splice(i, 1);
          progressed = true;
          continue;
        }

        const taskId = uuidv4();
        const parentTaskId = hasParent ? itemToTask.get(item.parent_item_id) : null;

        await connection.query(
          `
            INSERT INTO tasks (
              id, company_id, deliverable_id, parent_task_id,
              title, description, priority, due_date, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'to_do')
          `,
          [
            taskId,
            companyId,
            deliverable.id,
            parentTaskId,
            item.title,
            item.description,
            item.priority || 'medium',
            computeDueDate(baseDate, item.due_in_days),
          ]
        );

        itemToTask.set(item.id, taskId);
        existingTitleSet.add(normalized);
        createdCount += 1;
        pending.splice(i, 1);
        progressed = true;
      }

      if (!progressed) {
        throw new Error('Invalid bundle item hierarchy');
      }
    }

    await connection.commit();
    return { createdCount, skippedCount };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
