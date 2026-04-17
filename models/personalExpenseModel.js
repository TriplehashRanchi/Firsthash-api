const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const LIST_SELECT = `
  SELECT
    pe.id,
    pe.company_id,
    c.name AS company_name,
    pe.created_by_admin_uid,
    a.name AS created_by_name,
    pe.expense_date,
    pe.category_id,
    ec.name AS category_name,
    ec.description AS category_description,
    pe.title,
    pe.currency_code,
    pe.amount,
    pe.expense_type,
    pe.code_type,
    pe.code_value,
    pe.gst_treatment,
    pe.gst_number,
    pe.source_supply_state_code,
    ssm.state_name AS source_supply_state_name,
    pe.destination_supply_state_code,
    dsm.state_name AS destination_supply_state_name,
    pe.reverse_charge,
    pe.tax_name,
    pe.tax_rate,
    pe.tax_amount,
    pe.amount_is,
    pe.invoice_number,
    pe.notes,
    pe.party_id,
    p.name AS party_name,
    p.party_type,
    pe.subtotal,
    pe.total_amount,
    pe.itemize_json,
    pe.created_at,
    pe.updated_at,
    pe.deleted_at,
    (
      SELECT COUNT(*)
      FROM expense_attachments ea
      WHERE ea.personal_expense_id = pe.id
    ) AS attachment_count
  FROM personal_expense pe
  INNER JOIN expense_categories ec ON ec.id = pe.category_id
  LEFT JOIN parties p ON p.id = pe.party_id
  LEFT JOIN state_master ssm ON ssm.state_code = pe.source_supply_state_code
  LEFT JOIN state_master dsm ON dsm.state_code = pe.destination_supply_state_code
  LEFT JOIN companies c ON c.id = pe.company_id
  LEFT JOIN admins a ON a.firebase_uid = pe.created_by_admin_uid
`;

function toBoolean(value) {
  return Boolean(Number(value));
}

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseJsonValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
}

function mapExpenseRow(row, attachments = null) {
  if (!row) return null;

  const itemized = parseJsonValue(row.itemize_json);
  const mapped = {
    id: row.id,
    company_id: row.company_id,
    company_name: row.company_name || null,
    created_by_admin_uid: row.created_by_admin_uid,
    created_by_name: row.created_by_name || null,
    expense_date: row.expense_date,
    category_id: row.category_id,
    category_name: row.category_name || null,
    category_description: row.category_description || null,
    title: row.title || null,
    currency_code: row.currency_code,
    amount: Number(row.amount),
    expense_type: row.expense_type,
    code_type: row.code_type || null,
    code_value: row.code_value || null,
    gst_treatment: row.gst_treatment || null,
    gst_number: row.gst_number || null,
    source_supply_state_code: row.source_supply_state_code || null,
    source_supply_state_name: row.source_supply_state_name || null,
    destination_supply_state_code: row.destination_supply_state_code || null,
    destination_supply_state_name: row.destination_supply_state_name || null,
    reverse_charge: toBoolean(row.reverse_charge),
    tax_name: row.tax_name || null,
    tax_rate: toNumberOrNull(row.tax_rate),
    tax_amount: Number(row.tax_amount || 0),
    amount_is: row.amount_is,
    invoice_number: row.invoice_number || null,
    notes: row.notes || null,
    party_id: row.party_id || null,
    party_name: row.party_name || null,
    party_type: row.party_type || null,
    subtotal: toNumberOrNull(row.subtotal),
    total_amount: Number(row.total_amount || 0),
    itemize_json: itemized,
    itemized_items: itemized,
    attachment_count: Number(row.attachment_count || 0),
    attachments: attachments || [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    product_name: row.title || null,
    rupees: Number(row.total_amount || 0),
    purchase_date: row.expense_date,
  };

  return mapped;
}

async function getCategoryById(connection, companyId, categoryId) {
  const [rows] = await connection.query(
    `
    SELECT id, company_id, name, default_type, is_active
    FROM expense_categories
    WHERE id = ? AND company_id = ?
    LIMIT 1
    `,
    [categoryId, companyId]
  );

  return rows[0] || null;
}

async function getPartyById(connection, companyId, partyId) {
  if (!partyId) return null;

  const [rows] = await connection.query(
    `
    SELECT id, company_id, party_type, name, is_active
    FROM parties
    WHERE id = ? AND company_id = ?
    LIMIT 1
    `,
    [partyId, companyId]
  );

  return rows[0] || null;
}

async function getStateByCode(connection, stateCode) {
  if (!stateCode) return null;

  const [rows] = await connection.query(
    `
    SELECT state_code, state_name, is_active
    FROM state_master
    WHERE state_code = ?
    LIMIT 1
    `,
    [stateCode]
  );

  return rows[0] || null;
}

async function getAttachmentsByExpenseIds(connection, expenseIds) {
  if (!expenseIds.length) return new Map();

  const [rows] = await connection.query(
    `
    SELECT
      id,
      personal_expense_id,
      company_id,
      file_name,
      file_url,
      mime_type,
      file_size,
      uploaded_by_uid,
      created_at
    FROM expense_attachments
    WHERE personal_expense_id IN (?)
    ORDER BY created_at ASC
    `,
    [expenseIds]
  );

  const attachmentsByExpenseId = new Map();

  for (const row of rows) {
    const attachment = {
      id: row.id,
      personal_expense_id: row.personal_expense_id,
      company_id: row.company_id,
      file_name: row.file_name,
      file_url: row.file_url,
      mime_type: row.mime_type || null,
      file_size: row.file_size === null ? null : Number(row.file_size),
      uploaded_by_uid: row.uploaded_by_uid,
      created_at: row.created_at,
    };

    if (!attachmentsByExpenseId.has(row.personal_expense_id)) {
      attachmentsByExpenseId.set(row.personal_expense_id, []);
    }

    attachmentsByExpenseId.get(row.personal_expense_id).push(attachment);
  }

  return attachmentsByExpenseId;
}

function buildExpenseFilters(companyId, filters = {}) {
  const clauses = ['pe.company_id = ?'];
  const params = [companyId];

  if (!filters.includeDeleted) {
    clauses.push('pe.deleted_at IS NULL');
  }

  if (filters.category_id) {
    clauses.push('pe.category_id = ?');
    params.push(filters.category_id);
  }

  if (filters.party_id) {
    clauses.push('pe.party_id = ?');
    params.push(filters.party_id);
  }

  if (filters.expense_type) {
    clauses.push('pe.expense_type = ?');
    params.push(filters.expense_type);
  }

  if (filters.amount_is) {
    clauses.push('pe.amount_is = ?');
    params.push(filters.amount_is);
  }

  if (filters.date_from) {
    clauses.push('pe.expense_date >= ?');
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    clauses.push('pe.expense_date <= ?');
    params.push(filters.date_to);
  }

  if (filters.search) {
    clauses.push(`
      (
        pe.title LIKE ?
        OR pe.invoice_number LIKE ?
        OR pe.notes LIKE ?
        OR pe.code_value LIKE ?
        OR ec.name LIKE ?
        OR p.name LIKE ?
      )
    `);

    const searchLike = `%${filters.search}%`;
    params.push(searchLike, searchLike, searchLike, searchLike, searchLike, searchLike);
  }

  return {
    whereSql: `WHERE ${clauses.join(' AND ')}`,
    params,
  };
}

function getOrderByClause(sortBy, sortOrder) {
  const sortableColumns = {
    expense_date: 'pe.expense_date',
    created_at: 'pe.created_at',
    updated_at: 'pe.updated_at',
    total_amount: 'pe.total_amount',
    title: 'pe.title',
  };

  const safeColumn = sortableColumns[sortBy] || sortableColumns.expense_date;
  const safeDirection = String(sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  return `ORDER BY ${safeColumn} ${safeDirection}, pe.created_at DESC`;
}

async function syncExpenseAttachments(connection, { expenseId, companyId, uploadedByUid, attachments = [] }) {
  await connection.query(
    `
    DELETE FROM expense_attachments
    WHERE personal_expense_id = ? AND company_id = ?
    `,
    [expenseId, companyId]
  );

  if (!attachments.length) {
    return;
  }

  const values = attachments.map((attachment) => ([
    uuidv4(),
    expenseId,
    companyId,
    attachment.file_name,
    attachment.file_url,
    attachment.mime_type || null,
    attachment.file_size ?? null,
    uploadedByUid,
  ]));

  await connection.query(
    `
    INSERT INTO expense_attachments (
      id,
      personal_expense_id,
      company_id,
      file_name,
      file_url,
      mime_type,
      file_size,
      uploaded_by_uid
    ) VALUES ?
    `,
    [values]
  );
}

async function getPersonalExpensesByCompany(companyId, filters = {}) {
  const { whereSql, params } = buildExpenseFilters(companyId, filters);
  const orderBySql = getOrderByClause(filters.sort_by, filters.sort_order);

  const [rows] = await db.query(
    `
    ${LIST_SELECT}
    ${whereSql}
    ${orderBySql}
    `,
    params
  );

  return rows.map((row) => mapExpenseRow(row));
}

async function getPersonalExpenseById(id, companyId, options = {}) {
  const [rows] = await db.query(
    `
    ${LIST_SELECT}
    WHERE pe.id = ?
      AND pe.company_id = ?
      ${options.includeDeleted ? '' : 'AND pe.deleted_at IS NULL'}
    LIMIT 1
    `,
    [id, companyId]
  );

  const row = rows[0];
  if (!row) return null;

  const attachmentsByExpenseId = await getAttachmentsByExpenseIds(db, [id]);
  return mapExpenseRow(row, attachmentsByExpenseId.get(id) || []);
}

async function createPersonalExpense({ company_id, created_by_admin_uid, payload }) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const category = await getCategoryById(connection, company_id, payload.category_id);
    if (!category) {
      const error = new Error('Expense category not found.');
      error.statusCode = 400;
      throw error;
    }

    if (!Number(category.is_active)) {
      const error = new Error('Selected expense category is inactive.');
      error.statusCode = 400;
      throw error;
    }

    const effectiveExpenseType = payload.expense_type || category.default_type || null;
    if (!effectiveExpenseType) {
      const error = new Error('Expense type is required because the selected category has no default type.');
      error.statusCode = 400;
      throw error;
    }

    if (effectiveExpenseType === 'goods' && payload.code_type === 'sac') {
      const error = new Error('SAC code type is only valid for service expenses.');
      error.statusCode = 400;
      throw error;
    }

    if (effectiveExpenseType === 'services' && payload.code_type === 'hsn') {
      const error = new Error('HSN code type is only valid for goods expenses.');
      error.statusCode = 400;
      throw error;
    }

    const party = await getPartyById(connection, company_id, payload.party_id);
    if (payload.party_id && !party) {
      const error = new Error('Party not found.');
      error.statusCode = 400;
      throw error;
    }

    if (party && !Number(party.is_active)) {
      const error = new Error('Selected party is inactive.');
      error.statusCode = 400;
      throw error;
    }

    const sourceState = await getStateByCode(connection, payload.source_supply_state_code);
    if (payload.source_supply_state_code && !sourceState) {
      const error = new Error('Source supply state is invalid.');
      error.statusCode = 400;
      throw error;
    }
    if (sourceState && !Number(sourceState.is_active)) {
      const error = new Error('Source supply state is inactive.');
      error.statusCode = 400;
      throw error;
    }

    const destinationState = await getStateByCode(connection, payload.destination_supply_state_code);
    if (payload.destination_supply_state_code && !destinationState) {
      const error = new Error('Destination supply state is invalid.');
      error.statusCode = 400;
      throw error;
    }
    if (destinationState && !Number(destinationState.is_active)) {
      const error = new Error('Destination supply state is inactive.');
      error.statusCode = 400;
      throw error;
    }

    const id = uuidv4();

    await connection.query(
      `
      INSERT INTO personal_expense (
        id,
        company_id,
        created_by_admin_uid,
        expense_date,
        category_id,
        title,
        currency_code,
        amount,
        expense_type,
        code_type,
        code_value,
        gst_treatment,
        gst_number,
        source_supply_state_code,
        destination_supply_state_code,
        reverse_charge,
        tax_name,
        tax_rate,
        tax_amount,
        amount_is,
        invoice_number,
        notes,
        party_id,
        subtotal,
        total_amount,
        itemize_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        company_id,
        created_by_admin_uid,
        payload.expense_date,
        payload.category_id,
        payload.title,
        payload.currency_code,
        payload.amount,
        effectiveExpenseType,
        payload.code_type,
        payload.code_value,
        payload.gst_treatment,
        payload.gst_number,
        payload.source_supply_state_code,
        payload.destination_supply_state_code,
        0,
        payload.tax_name,
        payload.tax_rate,
        payload.tax_amount,
        payload.amount_is,
        payload.invoice_number,
        payload.notes,
        payload.party_id,
        payload.subtotal,
        payload.total_amount,
        payload.itemize_json === null ? null : JSON.stringify(payload.itemize_json),
      ]
    );

    await syncExpenseAttachments(connection, {
      expenseId: id,
      companyId: company_id,
      uploadedByUid: created_by_admin_uid,
      attachments: payload.attachments || [],
    });

    await connection.commit();
    return getPersonalExpenseById(id, company_id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updatePersonalExpense(id, companyId, payload, updatedByUid = null) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `
      SELECT id, created_by_admin_uid
      FROM personal_expense
      WHERE id = ? AND company_id = ? AND deleted_at IS NULL
      LIMIT 1
      `,
      [id, companyId]
    );

    if (!existingRows[0]) {
      await connection.rollback();
      return null;
    }

    const category = await getCategoryById(connection, companyId, payload.category_id);
    if (!category) {
      const error = new Error('Expense category not found.');
      error.statusCode = 400;
      throw error;
    }

    if (!Number(category.is_active)) {
      const error = new Error('Selected expense category is inactive.');
      error.statusCode = 400;
      throw error;
    }

    const effectiveExpenseType = payload.expense_type || category.default_type || null;
    if (!effectiveExpenseType) {
      const error = new Error('Expense type is required because the selected category has no default type.');
      error.statusCode = 400;
      throw error;
    }

    if (effectiveExpenseType === 'goods' && payload.code_type === 'sac') {
      const error = new Error('SAC code type is only valid for service expenses.');
      error.statusCode = 400;
      throw error;
    }

    if (effectiveExpenseType === 'services' && payload.code_type === 'hsn') {
      const error = new Error('HSN code type is only valid for goods expenses.');
      error.statusCode = 400;
      throw error;
    }

    const party = await getPartyById(connection, companyId, payload.party_id);
    if (payload.party_id && !party) {
      const error = new Error('Party not found.');
      error.statusCode = 400;
      throw error;
    }

    if (party && !Number(party.is_active)) {
      const error = new Error('Selected party is inactive.');
      error.statusCode = 400;
      throw error;
    }

    const sourceState = await getStateByCode(connection, payload.source_supply_state_code);
    if (payload.source_supply_state_code && !sourceState) {
      const error = new Error('Source supply state is invalid.');
      error.statusCode = 400;
      throw error;
    }
    if (sourceState && !Number(sourceState.is_active)) {
      const error = new Error('Source supply state is inactive.');
      error.statusCode = 400;
      throw error;
    }

    const destinationState = await getStateByCode(connection, payload.destination_supply_state_code);
    if (payload.destination_supply_state_code && !destinationState) {
      const error = new Error('Destination supply state is invalid.');
      error.statusCode = 400;
      throw error;
    }
    if (destinationState && !Number(destinationState.is_active)) {
      const error = new Error('Destination supply state is inactive.');
      error.statusCode = 400;
      throw error;
    }

    await connection.query(
      `
      UPDATE personal_expense
      SET
        expense_date = ?,
        category_id = ?,
        title = ?,
        currency_code = ?,
        amount = ?,
        expense_type = ?,
        code_type = ?,
        code_value = ?,
        gst_treatment = ?,
        gst_number = ?,
        source_supply_state_code = ?,
        destination_supply_state_code = ?,
        reverse_charge = ?,
        tax_name = ?,
        tax_rate = ?,
        tax_amount = ?,
        amount_is = ?,
        invoice_number = ?,
        notes = ?,
        party_id = ?,
        subtotal = ?,
        total_amount = ?,
        itemize_json = ?
      WHERE id = ? AND company_id = ? AND deleted_at IS NULL
      `,
      [
        payload.expense_date,
        payload.category_id,
        payload.title,
        payload.currency_code,
        payload.amount,
        effectiveExpenseType,
        payload.code_type,
        payload.code_value,
        payload.gst_treatment,
        payload.gst_number,
        payload.source_supply_state_code,
        payload.destination_supply_state_code,
        0,
        payload.tax_name,
        payload.tax_rate,
        payload.tax_amount,
        payload.amount_is,
        payload.invoice_number,
        payload.notes,
        payload.party_id,
        payload.subtotal,
        payload.total_amount,
        payload.itemize_json === null ? null : JSON.stringify(payload.itemize_json),
        id,
        companyId,
      ]
    );

    await syncExpenseAttachments(connection, {
      expenseId: id,
      companyId,
      uploadedByUid: updatedByUid || existingRows[0].created_by_admin_uid,
      attachments: payload.attachments || [],
    });

    await connection.commit();
    return getPersonalExpenseById(id, companyId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deletePersonalExpense(id, companyId) {
  const [result] = await db.query(
    `
    UPDATE personal_expense
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = ? AND company_id = ? AND deleted_at IS NULL
    `,
    [id, companyId]
  );

  return result.affectedRows > 0;
}

async function getPersonalExpenseSummary(companyId, filters = {}) {
  const { whereSql, params } = buildExpenseFilters(companyId, filters);

  const [rows] = await db.query(
    `
    SELECT
      COUNT(*) AS total_records,
      COALESCE(SUM(pe.amount), 0) AS entered_amount,
      COALESCE(SUM(pe.subtotal), 0) AS subtotal_amount,
      COALESCE(SUM(pe.tax_amount), 0) AS total_tax_amount,
      COALESCE(SUM(pe.total_amount), 0) AS total_spend
    FROM personal_expense pe
    INNER JOIN expense_categories ec ON ec.id = pe.category_id
    LEFT JOIN parties p ON p.id = pe.party_id
    ${whereSql}
    `,
    params
  );

  const row = rows[0] || {};

  return {
    total_records: Number(row.total_records || 0),
    entered_amount: Number(row.entered_amount || 0),
    subtotal_amount: Number(row.subtotal_amount || 0),
    total_tax_amount: Number(row.total_tax_amount || 0),
    total_spend: Number(row.total_spend || 0),
  };
}

async function getExpenseMeta(companyId) {
  const [categories, parties, states] = await Promise.all([
    listExpenseCategories(companyId, { onlyActive: true }),
    listParties(companyId, { onlyActive: true }),
    listStates({ onlyActive: true }),
  ]);

  return {
    categories,
    parties,
    states,
    enums: {
      expense_type: ['goods', 'services'],
      code_type: ['hsn', 'sac'],
      amount_is: ['inclusive', 'exclusive'],
      party_type: ['worker', 'shop', 'customer', 'vendor', 'other'],
    },
  };
}

async function listExpenseCategories(companyId, options = {}) {
  const clauses = ['company_id = ?'];
  const params = [companyId];

  if (options.onlyActive) {
    clauses.push('is_active = 1');
  }

  const [rows] = await db.query(
    `
    SELECT
      id,
      company_id,
      name,
      description,
      default_type,
      is_active,
      created_at,
      updated_at
    FROM expense_categories
    WHERE ${clauses.join(' AND ')}
    ORDER BY name ASC
    `,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    description: row.description || null,
    default_type: row.default_type || null,
    is_active: toBoolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

async function createExpenseCategory(companyId, payload) {
  const id = uuidv4();

  await db.query(
    `
    INSERT INTO expense_categories (
      id,
      company_id,
      name,
      description,
      default_type,
      is_active
    ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      companyId,
      payload.name,
      payload.description,
      payload.default_type,
      payload.is_active ? 1 : 0,
    ]
  );

  const [rows] = await db.query(
    `
    SELECT
      id,
      company_id,
      name,
      description,
      default_type,
      is_active,
      created_at,
      updated_at
    FROM expense_categories
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0]
    ? {
        ...rows[0],
        description: rows[0].description || null,
        default_type: rows[0].default_type || null,
        is_active: toBoolean(rows[0].is_active),
      }
    : null;
}

async function listParties(companyId, options = {}) {
  const clauses = ['company_id = ?'];
  const params = [companyId];

  if (options.onlyActive) {
    clauses.push('is_active = 1');
  }

  if (options.party_type) {
    clauses.push('party_type = ?');
    params.push(options.party_type);
  }

  const [rows] = await db.query(
    `
    SELECT
      id,
      company_id,
      party_type,
      name,
      is_active,
      created_at,
      updated_at
    FROM parties
    WHERE ${clauses.join(' AND ')}
    ORDER BY name ASC
    `,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    company_id: row.company_id,
    party_type: row.party_type,
    name: row.name,
    notes: null,
    is_active: toBoolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

async function createParty(companyId, payload) {
  const id = uuidv4();

  await db.query(
    `
    INSERT INTO parties (
      id,
      company_id,
      party_type,
      name,
      is_active
    ) VALUES (?, ?, ?, ?, ?)
    `,
    [
      id,
      companyId,
      payload.party_type,
      payload.name,
      payload.is_active ? 1 : 0,
    ]
  );

  const [rows] = await db.query(
    `
    SELECT
      id,
      company_id,
      party_type,
      name,
      is_active,
      created_at,
      updated_at
    FROM parties
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0]
    ? {
        ...rows[0],
        notes: null,
        is_active: toBoolean(rows[0].is_active),
      }
    : null;
}

async function listStates(options = {}) {
  const clauses = [];
  const params = [];

  if (options.onlyActive) {
    clauses.push('is_active = 1');
  }

  const [rows] = await db.query(
    `
    SELECT
      state_code,
      state_name,
      country_code,
      is_active,
      created_at,
      updated_at
    FROM state_master
    ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
    ORDER BY state_name ASC
    `,
    params
  );

  return rows.map((row) => ({
    state_code: row.state_code,
    state_name: row.state_name,
    country_code: row.country_code,
    is_active: toBoolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

module.exports = {
  getPersonalExpensesByCompany,
  getPersonalExpenseById,
  createPersonalExpense,
  updatePersonalExpense,
  deletePersonalExpense,
  getPersonalExpenseSummary,
  getExpenseMeta,
  listExpenseCategories,
  createExpenseCategory,
  listParties,
  createParty,
  listStates,
};
