const db = require('../config/db');

const leadExists = async (fbLeadId) => {
  const query = `SELECT id FROM leads WHERE fb_lead_id = ?`;
  const [rows] = await db.query(query, [fbLeadId]);
  return rows.length > 0;
};

const insertLead = async (leadData) => {
  const leadId = leadData.id || Math.floor(Math.random() * 100000000);

  const sql = `
    INSERT INTO leads 
      (id, admin_id, fb_lead_id, full_name, email, phone_number,
       address, lead_status, source, form_name,
       raw_payload, notes, created_at)
    VALUES 
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  const values = [
    leadId,
    leadData.admin_id,
    leadData.fb_lead_id,
    leadData.full_name,
    leadData.email,
    leadData.phone_number,
    leadData.address,
    leadData.lead_status || 'new',
    leadData.source,
    leadData.form_name || null,
    JSON.stringify(leadData.raw_payload || null),
    null,
  ];

  const [result] = await db.query(sql, values);
  return result.insertId;
};

const getExistingIds = async (idArray) => {
  if (!idArray.length) return new Set();
  const [rows] = await db.query(
    `SELECT fb_lead_id FROM leads WHERE fb_lead_id IN (?)`,
    [idArray]
  );
  return new Set(rows.map((r) => r.fb_lead_id));
};

const bulkInsert = async (leads) => {
  if (!leads.length) return;

  const values = leads.map((l) => [
    l.id || Math.floor(Math.random() * 100000000),
    l.admin_id,
    l.fb_lead_id,
    l.full_name,
    l.email,
    l.phone_number,
    l.address,
    l.lead_status || 'new',
    l.source,
    l.form_name,
    JSON.stringify(l.raw_payload || null),
    null,
    l.created_time || new Date(),
  ]);

  const sql = `
    INSERT INTO leads
      (id, admin_id, fb_lead_id, full_name, email, phone_number,
       address, lead_status, source, form_name, raw_payload, notes, created_at)
    VALUES ?
    ON DUPLICATE KEY UPDATE fb_lead_id = fb_lead_id
  `;

  await db.query(sql, [values]);
};

module.exports = { leadExists, insertLead, getExistingIds, bulkInsert };
