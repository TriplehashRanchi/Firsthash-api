const db = require('../config/db');

// Get all templates for a company
exports.getAllDeliverableTemplates = async (company_id) => {
  const [rows] = await db.query(
    `SELECT id, title FROM deliverable_templates WHERE company_id = ? ORDER BY title ASC`,
    [company_id]
  );
  return rows;
};

// Add a new template (ignore duplicates)
exports.addDeliverableTemplate = async (company_id, title) => {
  await db.query(
    `INSERT IGNORE INTO deliverable_templates (company_id, title) VALUES (?, ?)`,
    [company_id, title]
  );
};

// Delete a template by ID
exports.deleteDeliverableTemplate = async (id) => {
  await db.query(`DELETE FROM deliverable_templates WHERE id = ?`, [id]);
};
