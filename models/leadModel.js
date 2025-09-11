// models/leadModel.js
const db  = require('../config/db');

const createLead = async (leadData) => {

    console.log('leadData:', leadData);
  try {
    const [results] = await db.query('INSERT INTO leads SET ?', [leadData]);
    console.log('New lead created with ID:', results.insertId);

    return { id: results.insertId, ...leadData };
  } catch (err) {
    console.error('Database Error: Failed to create lead.', err);
    throw new Error('Error adding new lead to the database.');
  }
};

const getAllLeadsByAdmin = async (admin_id) => {
  try {
    const query = "SELECT * FROM leads WHERE admin_id = ? ORDER BY created_at DESC";
    const [leads] = await db.query(query, [admin_id]);
    return leads;
  } catch (err) {
    console.error('Database Error: Failed to fetch leads.', err);
    throw new Error('Error fetching leads from the database.');
  }
};

module.exports = {
  createLead,
  getAllLeadsByAdmin,
};