const personalExpenseModel = require('../models/personalExpenseModel');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_EXPENSE_TYPES = new Set(['goods', 'services']);
const ALLOWED_CODE_TYPES = new Set(['hsn', 'sac']);
const ALLOWED_AMOUNT_IS = new Set(['inclusive', 'exclusive']);
const ALLOWED_PARTY_TYPES = new Set(['worker', 'shop', 'customer', 'vendor', 'other']);
const GST_NUMBER_REGEX = /^[0-9A-Z]{15}$/;
const ALLOWED_GST_TREATMENTS = new Set(['with_gst', 'without_gst']);

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeString(value, { maxLength = null, uppercase = false } = {}) {
  if (value === null || value === undefined || value === '') return null;

  const normalized = String(value).trim();
  if (!normalized) return null;

  const finalValue = uppercase ? normalized.toUpperCase() : normalized;
  if (maxLength && finalValue.length > maxLength) {
    throw badRequest(`Value must be ${maxLength} characters or less.`);
  }

  return finalValue;
}

function normalizeBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(lowered)) return true;
    if (['false', '0', 'no'].includes(lowered)) return false;
  }

  throw badRequest('Boolean field is invalid.');
}

function normalizeDateOnly(value, fieldLabel) {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw badRequest(`${fieldLabel} is required.`);
  }

  if (!DATE_ONLY_REGEX.test(normalized)) {
    throw badRequest(`${fieldLabel} must be in YYYY-MM-DD format.`);
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw badRequest(`${fieldLabel} must be a valid date.`);
  }

  return normalized;
}

function ensurePastOrToday(dateValue, fieldLabel) {
  const today = new Date().toISOString().slice(0, 10);
  if (dateValue > today) {
    throw badRequest(`${fieldLabel} cannot be in the future.`);
  }
}

function normalizeUuid(value, fieldLabel, { required = false } = {}) {
  const normalized = normalizeString(value);
  if (!normalized) {
    if (required) {
      throw badRequest(`${fieldLabel} is required.`);
    }
    return null;
  }

  if (!UUID_REGEX.test(normalized)) {
    throw badRequest(`${fieldLabel} is invalid.`);
  }

  return normalized;
}

function normalizeEnum(value, allowedValues, fieldLabel, { required = false, fallback = null } = {}) {
  const normalized = normalizeString(value);

  if (!normalized) {
    if (required) {
      throw badRequest(`${fieldLabel} is required.`);
    }
    return fallback;
  }

  if (!allowedValues.has(normalized)) {
    throw badRequest(`${fieldLabel} is invalid.`);
  }

  return normalized;
}

function normalizeDecimal(value, fieldLabel, { required = false, min = null, max = null } = {}) {
  if (value === null || value === undefined || value === '') {
    if (required) {
      throw badRequest(`${fieldLabel} is required.`);
    }
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw badRequest(`${fieldLabel} must be a valid number.`);
  }

  if (min !== null && number < min) {
    throw badRequest(`${fieldLabel} must be at least ${min}.`);
  }

  if (max !== null && number > max) {
    throw badRequest(`${fieldLabel} must be at most ${max}.`);
  }

  return Number(number.toFixed(2));
}

function normalizeItemizedJson(value) {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw badRequest('itemize_json must be valid JSON.');
    }
  }

  if (typeof value !== 'object') {
    throw badRequest('itemize_json must be an object, array, or JSON string.');
  }

  return value;
}

function normalizeAttachments(value) {
  if (value === undefined || value === null || value === '') return [];

  const parsedValue = typeof value === 'string'
    ? (() => {
        try {
          return JSON.parse(value);
        } catch (error) {
          throw badRequest('attachments must be valid JSON.');
        }
      })()
    : value;

  if (!Array.isArray(parsedValue)) {
    throw badRequest('attachments must be an array.');
  }

  return parsedValue.map((attachment, index) => {
    if (!attachment || typeof attachment !== 'object') {
      throw badRequest(`Attachment ${index + 1} is invalid.`);
    }

    const file_name = normalizeString(attachment.file_name || attachment.name, { maxLength: 255 });
    const file_url = normalizeString(attachment.file_url || attachment.url, { maxLength: 2048 });

    if (!file_name || !file_url) {
      throw badRequest(`Attachment ${index + 1} must include file_name and file_url.`);
    }

    return {
      file_name,
      file_url,
      mime_type: normalizeString(attachment.mime_type || attachment.mimeType, { maxLength: 120 }),
      file_size: normalizeDecimal(attachment.file_size ?? attachment.size, 'Attachment file size', { min: 0, max: 10485760 }),
    };
  });
}

function deriveTaxFromRate(amount, amountIs, taxRate) {
  if (!taxRate) return 0;

  if (amountIs === 'exclusive') {
    return Number(((amount * taxRate) / 100).toFixed(2));
  }

  const divisor = 1 + taxRate / 100;
  return Number((amount - amount / divisor).toFixed(2));
}

function normalizeExpensePayload(body = {}) {
  const expenseDate = normalizeDateOnly(body.expense_date || body.purchase_date, 'Expense date');
  ensurePastOrToday(expenseDate, 'Expense date');

  const categoryId = normalizeUuid(body.category_id, 'Category id', { required: true });
  const title = normalizeString(body.title || body.product_name, { maxLength: 255 });
  const currencyCode = normalizeString(body.currency_code, { maxLength: 10, uppercase: true }) || 'INR';

  const amountIs = normalizeEnum(body.amount_is, ALLOWED_AMOUNT_IS, 'Amount type', {
    fallback: 'exclusive',
  });

  const amount = normalizeDecimal(body.amount ?? body.total_amount ?? body.rupees, 'Amount', {
    required: true,
    min: 0.01,
    max: 9999999999.99,
  });

  const taxRate = normalizeDecimal(body.tax_rate, 'Tax rate', { min: 0, max: 100 });
  let taxAmount = normalizeDecimal(body.tax_amount, 'Tax amount', { min: 0, max: 9999999999.99 });
  if (taxAmount === null) {
    taxAmount = deriveTaxFromRate(amount, amountIs, taxRate);
  }

  let subtotal = null;
  let totalAmount = null;

  if (amountIs === 'exclusive') {
    subtotal = Number(amount.toFixed(2));
    totalAmount = Number((amount + taxAmount).toFixed(2));
  } else {
    if (taxAmount > amount) {
      throw badRequest('Tax amount cannot be greater than the inclusive amount.');
    }
    totalAmount = Number(amount.toFixed(2));
    subtotal = Number(Math.max(0, amount - taxAmount).toFixed(2));
  }

  if (subtotal > totalAmount) {
    throw badRequest('Subtotal cannot be greater than total amount.');
  }

  if (taxRate !== null) {
    const expectedTax = deriveTaxFromRate(amount, amountIs, taxRate);
    if (Math.abs(expectedTax - taxAmount) > 1) {
      throw badRequest('Tax amount does not match the provided tax rate.');
    }
  }

  const expenseType = normalizeEnum(body.expense_type, ALLOWED_EXPENSE_TYPES, 'Expense type');
  const codeType = normalizeEnum(body.code_type, ALLOWED_CODE_TYPES, 'Code type');
  const codeValue = normalizeString(body.code_value, { maxLength: 50 });

  if (codeType && !codeValue) {
    throw badRequest('Code value is required when code type is provided.');
  }

  if (!codeType && codeValue) {
    throw badRequest('Code type is required when code value is provided.');
  }

  if (expenseType === 'goods' && codeType === 'sac') {
    throw badRequest('SAC code type is only valid for service expenses.');
  }

  if (expenseType === 'services' && codeType === 'hsn') {
    throw badRequest('HSN code type is only valid for goods expenses.');
  }

  return {
    expense_date: expenseDate,
    category_id: categoryId,
    title,
    currency_code: currencyCode,
    amount,
    expense_type: expenseType,
    code_type: codeType,
    code_value: codeValue,
    gst_treatment: normalizeString(body.gst_treatment, { maxLength: 50 }),
    gst_number: (() => {
      const normalized = normalizeString(body.gst_number, { maxLength: 15, uppercase: true });
      if (normalized && !GST_NUMBER_REGEX.test(normalized)) {
        throw badRequest('GST number must be 15 uppercase alphanumeric characters.');
      }
      return normalized;
    })(),
    source_supply_state_code: normalizeString(body.source_supply_state_code, { maxLength: 10, uppercase: true }),
    destination_supply_state_code: normalizeString(body.destination_supply_state_code, { maxLength: 10, uppercase: true }),
    reverse_charge: normalizeBoolean(body.reverse_charge, false),
    tax_name: normalizeString(body.tax_name, { maxLength: 100 }),
    tax_rate: taxRate,
    tax_amount: taxAmount,
    amount_is: amountIs,
    invoice_number: normalizeString(body.invoice_number, { maxLength: 100 }),
    notes: normalizeString(body.notes, { maxLength: 500 }),
    party_id: normalizeUuid(body.party_id, 'Party id'),
    subtotal,
    total_amount: totalAmount,
    itemize_json: null,
    attachments: normalizeAttachments(body.attachments),
  };
}

function normalizeCategoryPayload(body = {}) {
  const name = normalizeString(body.name, { maxLength: 100 });
  if (!name) {
    throw badRequest('Category name is required.');
  }

  return {
    name,
    description: normalizeString(body.description, { maxLength: 500 }),
    default_type: normalizeEnum(body.default_type, ALLOWED_EXPENSE_TYPES, 'Default type'),
    is_active: normalizeBoolean(body.is_active, true),
  };
}

function normalizePartyPayload(body = {}) {
  const name = normalizeString(body.name, { maxLength: 255 });
  if (!name) {
    throw badRequest('Party name is required.');
  }

  return {
    party_type: normalizeEnum(body.party_type, ALLOWED_PARTY_TYPES, 'Party type', {
      fallback: 'other',
    }),
    name,
    notes: normalizeString(body.notes, { maxLength: 255 }),
    is_active: normalizeBoolean(body.is_active, true),
  };
}

function normalizeListFilters(query = {}) {
  const filters = {
    search: normalizeString(query.search),
    category_id: normalizeUuid(query.category_id, 'Category id'),
    party_id: normalizeUuid(query.party_id, 'Party id'),
    expense_type: normalizeEnum(query.expense_type, ALLOWED_EXPENSE_TYPES, 'Expense type'),
    amount_is: normalizeEnum(query.amount_is, ALLOWED_AMOUNT_IS, 'Amount type'),
    date_from: query.date_from ? normalizeDateOnly(query.date_from, 'date_from') : null,
    date_to: query.date_to ? normalizeDateOnly(query.date_to, 'date_to') : null,
    includeDeleted: normalizeBoolean(query.include_deleted, false),
    sort_by: normalizeString(query.sort_by) || 'expense_date',
    sort_order: normalizeString(query.sort_order) || 'desc',
  };

  if (filters.date_from && filters.date_to && filters.date_from > filters.date_to) {
    throw badRequest('date_from cannot be greater than date_to.');
  }

  return filters;
}

function handleError(res, error, fallbackMessage) {
  const statusCode = error.statusCode || (error.code === 'ER_DUP_ENTRY' ? 409 : 500);

  if (statusCode >= 500) {
    console.error(fallbackMessage, error);
  }

  const errorMessage =
    statusCode === 409
      ? 'A record with the same unique value already exists.'
      : error.message || fallbackMessage;

  return res.status(statusCode).json({ error: errorMessage });
}

exports.getExpenseMeta = async (req, res) => {
  try {
    const companyId = req.company?.id;
    if (!companyId) {
      return res.status(403).json({ error: 'Company context missing.' });
    }

    const meta = await personalExpenseModel.getExpenseMeta(companyId);
    return res.json(meta);
  } catch (error) {
    return handleError(res, error, 'Failed to load personal expense metadata.');
  }
};

exports.getExpenseSummary = async (req, res) => {
  try {
    const companyId = req.company?.id;
    if (!companyId) {
      return res.status(403).json({ error: 'Company context missing.' });
    }

    const filters = normalizeListFilters(req.query);
    const summary = await personalExpenseModel.getPersonalExpenseSummary(companyId, filters);
    return res.json(summary);
  } catch (error) {
    return handleError(res, error, 'Failed to load personal expense summary.');
  }
};

exports.getPersonalExpenses = async (req, res) => {
  try {
    const companyId = req.company?.id;
    if (!companyId) {
      return res.status(403).json({ error: 'Company context missing.' });
    }

    const filters = normalizeListFilters(req.query);
    const rows = await personalExpenseModel.getPersonalExpensesByCompany(companyId, filters);
    return res.json(rows);
  } catch (error) {
    return handleError(res, error, 'Failed to load personal expenses.');
  }
};

exports.getPersonalExpenseById = async (req, res) => {
  try {
    const companyId = req.company?.id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(403).json({ error: 'Company context missing.' });
    }

    if (!UUID_REGEX.test(String(id || ''))) {
      return res.status(400).json({ error: 'Invalid personal expense id.' });
    }

    const row = await personalExpenseModel.getPersonalExpenseById(id, companyId);
    if (!row) {
      return res.status(404).json({ error: 'Personal expense not found.' });
    }

    return res.json(row);
  } catch (error) {
    return handleError(res, error, 'Failed to load personal expense.');
  }
};

exports.createPersonalExpense = async (req, res) => {
  try {
    const companyId = req.company?.id;
    const createdByAdminUid = req.user?.firebase_uid;

    if (!companyId || !createdByAdminUid) {
      return res.status(403).json({ error: 'Admin or company context missing.' });
    }

    const payload = normalizeExpensePayload(req.body);
    const row = await personalExpenseModel.createPersonalExpense({
      company_id: companyId,
      created_by_admin_uid: createdByAdminUid,
      payload,
    });

    return res.status(201).json(row);
  } catch (error) {
    return handleError(res, error, 'Failed to create personal expense.');
  }
};

exports.updatePersonalExpense = async (req, res) => {
  try {
    const companyId = req.company?.id;
    const { id } = req.params;
    const updatedByAdminUid = req.user?.firebase_uid;

    if (!companyId || !updatedByAdminUid) {
      return res.status(403).json({ error: 'Company context missing.' });
    }

    if (!UUID_REGEX.test(String(id || ''))) {
      return res.status(400).json({ error: 'Invalid personal expense id.' });
    }

    const payload = normalizeExpensePayload(req.body);
    const row = await personalExpenseModel.updatePersonalExpense(id, companyId, payload, updatedByAdminUid);

    if (!row) {
      return res.status(404).json({ error: 'Personal expense not found.' });
    }

    return res.json(row);
  } catch (error) {
    return handleError(res, error, 'Failed to update personal expense.');
  }
};

exports.deletePersonalExpense = async (req, res) => {
  try {
    const companyId = req.company?.id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(403).json({ error: 'Company context missing.' });
    }

    if (!UUID_REGEX.test(String(id || ''))) {
      return res.status(400).json({ error: 'Invalid personal expense id.' });
    }

    const deleted = await personalExpenseModel.deletePersonalExpense(id, companyId);
    if (!deleted) {
      return res.status(404).json({ error: 'Personal expense not found.' });
    }

    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error, 'Failed to delete personal expense.');
  }
};

exports.getExpenseCategories = async (req, res) => {
  try {
    const companyId = req.company?.id;
    if (!companyId) {
      return res.status(403).json({ error: 'Company context missing.' });
    }

    const onlyActive = normalizeBoolean(req.query.only_active, true);
    const rows = await personalExpenseModel.listExpenseCategories(companyId, { onlyActive });
    return res.json(rows);
  } catch (error) {
    return handleError(res, error, 'Failed to load expense categories.');
  }
};

exports.createExpenseCategory = async (req, res) => {
  try {
    const companyId = req.company?.id;
    if (!companyId) {
      return res.status(403).json({ error: 'Company context missing.' });
    }

    const payload = normalizeCategoryPayload(req.body);
    const row = await personalExpenseModel.createExpenseCategory(companyId, payload);
    return res.status(201).json(row);
  } catch (error) {
    return handleError(res, error, 'Failed to create expense category.');
  }
};

exports.getParties = async (req, res) => {
  try {
    const companyId = req.company?.id;
    if (!companyId) {
      return res.status(403).json({ error: 'Company context missing.' });
    }

    const onlyActive = normalizeBoolean(req.query.only_active, true);
    const partyType = normalizeEnum(req.query.party_type, ALLOWED_PARTY_TYPES, 'Party type');
    const rows = await personalExpenseModel.listParties(companyId, {
      onlyActive,
      party_type: partyType,
    });

    return res.json(rows);
  } catch (error) {
    return handleError(res, error, 'Failed to load parties.');
  }
};

exports.createParty = async (req, res) => {
  try {
    const companyId = req.company?.id;
    if (!companyId) {
      return res.status(403).json({ error: 'Company context missing.' });
    }

    const payload = normalizePartyPayload(req.body);
    const row = await personalExpenseModel.createParty(companyId, payload);
    return res.status(201).json(row);
  } catch (error) {
    return handleError(res, error, 'Failed to create party.');
  }
};

exports.getStates = async (_req, res) => {
  try {
    const rows = await personalExpenseModel.listStates({ onlyActive: true });
    return res.json(rows);
  } catch (error) {
    return handleError(res, error, 'Failed to load states.');
  }
};
