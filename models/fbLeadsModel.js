const db = require('../config/db');

let leadTableColumnsCache = null;

const getLeadTableColumns = async () => {
  if (!leadTableColumnsCache) {
    const [rows] = await db.query(`SHOW COLUMNS FROM leads`);
    leadTableColumnsCache = new Set(rows.map((row) => row.Field));
  }

  return leadTableColumnsCache;
};

const getFbLeadIdFromInput = (leadData) => {
  if (!leadData) return null;
  if (typeof leadData === 'string') return leadData;

  return leadData.fb_lead_id || leadData.fbLeadId || null;
};

const leadExists = async (leadData) => {
  const columns = await getLeadTableColumns();
  const fbLeadId = getFbLeadIdFromInput(leadData);

  if (columns.has('fb_lead_id') && fbLeadId) {
    const [rows] = await db.query(`SELECT id FROM leads WHERE fb_lead_id = ?`, [
      fbLeadId,
    ]);
    return rows.length > 0;
  }

  if (!fbLeadId) return false;

  try {
    const [rows] = await db.query(
      `
        SELECT id
        FROM leads
        WHERE JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.id')) = ?
        LIMIT 1
      `,
      [fbLeadId]
    );

    return rows.length > 0;
  } catch (error) {
    return false;
  }
};

const buildLeadPayload = (leadData, columns) => {
  const payload = {
    admin_id: leadData.admin_id || null,
    full_name: leadData.full_name || '',
    email: leadData.email || '',
    phone_number: leadData.phone_number || '',
    address: leadData.address || null,
    date: leadData.date || null,
    gender: leadData.gender || null,
    company_name: leadData.company_name || null,
    event_location: leadData.event_location || null,
    event_month: leadData.event_month || null,
    coverage_amount: leadData.coverage_amount ?? null,
    source: leadData.source || 'Facebook',
    lead_status: leadData.lead_status || 'New',
    raw_payload: JSON.stringify(leadData.raw_payload || null),
  };

  if (columns.has('fb_lead_id')) {
    payload.fb_lead_id = leadData.fb_lead_id || null;
  }

  if (columns.has('form_name')) {
    payload.form_name = leadData.form_name || null;
  }

  if (columns.has('notes')) {
    payload.notes = leadData.notes || null;
  }

  if (columns.has('created_at') && leadData.created_time) {
    payload.created_at = leadData.created_time;
  }

  return Object.fromEntries(
    Object.entries(payload).filter(
      ([column, value]) => columns.has(column) && value !== undefined
    )
  );
};

const insertLead = async (leadData) => {
  const columns = await getLeadTableColumns();
  const payload = buildLeadPayload(leadData, columns);

  const payloadColumns = Object.keys(payload);
  const placeholders = payloadColumns.map(() => '?').join(', ');

  const sql = `INSERT INTO leads (${payloadColumns.join(
    ', '
  )}) VALUES (${placeholders})`;
  const values = payloadColumns.map((column) => payload[column]);

  const [result] = await db.query(sql, values);
  return result.insertId;
};

const getExistingIds = async (idArray) => {
  if (!idArray.length) return new Set();
  const columns = await getLeadTableColumns();

  if (columns.has('fb_lead_id')) {
    const [rows] = await db.query(
      `SELECT fb_lead_id FROM leads WHERE fb_lead_id IN (?)`,
      [idArray]
    );
    return new Set(rows.map((row) => row.fb_lead_id));
  }

  try {
    const [rows] = await db.query(
      `
        SELECT JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.id')) AS fb_lead_id
        FROM leads
        WHERE JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.id')) IN (?)
      `,
      [idArray]
    );

    return new Set(rows.map((row) => row.fb_lead_id).filter(Boolean));
  } catch (error) {
    return new Set();
  }
};

const bulkInsert = async (leads) => {
  if (!leads.length) return;

  for (const lead of leads) {
    const alreadyExists = await leadExists(lead);
    if (alreadyExists) continue;
    await insertLead(lead);
  }
};

module.exports = { leadExists, insertLead, getExistingIds, bulkInsert };
