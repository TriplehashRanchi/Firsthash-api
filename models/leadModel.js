// models/leadModel.js
const db  = require('../config/db');

const createLead = async (leadData) => {

    console.log('leadData:', leadData);
  try {
     const dataToInsert = { lead_status: 'New', ...leadData };
    const [results] = await db.query('INSERT INTO leads SET ?', [dataToInsert]);
    console.log('New lead created with ID:', results.insertId);

    return { id: results.insertId, ...dataToInsert };
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
const updateLeadStatus = async (leadId, leadStatus) => {
    try {
        const query = "UPDATE leads SET lead_status = ? WHERE id = ?";
        const [result] = await db.query(query, [leadStatus, leadId]);
        return result.affectedRows; // Returns 1 if update was successful, 0 otherwise
    } catch (err) {
        console.error('Database Error: Failed to update lead status.', err);
        throw new Error('Error updating lead status in the database.');
    }
};
module.exports = {
  createLead,
  getAllLeadsByAdmin,
  updateLeadStatus
};