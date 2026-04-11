const personalExpenseModel = require('../models/personalExpenseModel');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizePayload(body = {}) {
  return {
    product_name: String(body.product_name || '').trim(),
    rupees: Number(body.rupees),
    purchase_date: body.purchase_date,
    notes: String(body.notes || '').trim(),
  };
}

function validatePayload(payload) {
  if (!payload.product_name) {
    return 'Product name is required.';
  }

  if (payload.product_name.length > 255) {
    return 'Product name must be 255 characters or less.';
  }

  if (!Number.isFinite(payload.rupees) || payload.rupees <= 0) {
    return 'Rupees must be a valid number greater than zero.';
  }

  if (!isValidDateOnly(payload.purchase_date)) {
    return 'Purchase date must be a valid date in YYYY-MM-DD format.';
  }

  if (payload.purchase_date > new Date().toISOString().slice(0, 10)) {
    return 'Purchase date cannot be in the future.';
  }

  if (payload.notes.length > 5000) {
    return 'Notes must be 5000 characters or less.';
  }

  return null;
}

exports.getPersonalExpenses = async (req, res) => {
  try {
    const company_id = req.company?.id;
    if (!company_id) {
      return res.status(403).json({ error: 'Company context missing.' });
    }

    const rows = await personalExpenseModel.getPersonalExpensesByCompany(company_id);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch personal expenses:', err);
    res.status(500).json({ error: 'Failed to load personal expenses.' });
  }
};

exports.createPersonalExpense = async (req, res) => {
  try {
    const company_id = req.company?.id;
    const created_by_admin_uid = req.user?.firebase_uid;

    if (!company_id || !created_by_admin_uid) {
      return res.status(403).json({ error: 'Admin or company context missing.' });
    }

    const payload = normalizePayload(req.body);
    const validationError = validatePayload(payload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const row = await personalExpenseModel.createPersonalExpense({
      company_id,
      created_by_admin_uid,
      ...payload,
    });

    res.status(201).json(row);
  } catch (err) {
    console.error('Failed to create personal expense:', err);
    res.status(500).json({ error: 'Failed to create personal expense.' });
  }
};

exports.updatePersonalExpense = async (req, res) => {
  try {
    const company_id = req.company?.id;
    const { id } = req.params;

    if (!company_id) {
      return res.status(403).json({ error: 'Company context missing.' });
    }

    if (!UUID_REGEX.test(String(id || ''))) {
      return res.status(400).json({ error: 'Invalid personal expense id.' });
    }

    const payload = normalizePayload(req.body);
    const validationError = validatePayload(payload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const row = await personalExpenseModel.updatePersonalExpense(id, company_id, payload);
    if (!row) {
      return res.status(404).json({ error: 'Personal expense not found.' });
    }

    res.json(row);
  } catch (err) {
    console.error('Failed to update personal expense:', err);
    res.status(500).json({ error: 'Failed to update personal expense.' });
  }
};

exports.deletePersonalExpense = async (req, res) => {
  try {
    const company_id = req.company?.id;
    const { id } = req.params;

    if (!company_id) {
      return res.status(403).json({ error: 'Company context missing.' });
    }

    if (!UUID_REGEX.test(String(id || ''))) {
      return res.status(400).json({ error: 'Invalid personal expense id.' });
    }

    const deleted = await personalExpenseModel.deletePersonalExpense(id, company_id);
    if (!deleted) {
      return res.status(404).json({ error: 'Personal expense not found.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete personal expense:', err);
    res.status(500).json({ error: 'Failed to delete personal expense.' });
  }
};
