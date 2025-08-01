// File: models/serviceModel.js
const db = require('../config/db');

exports.getServicesByCompany = (company_id) => {
  return db.query('SELECT id, name FROM services WHERE company_id = ? ORDER BY name ASC', [company_id]);
};

exports.addService = (company_id, name) => {
  return db.query('INSERT IGNORE INTO services (company_id, name) VALUES (?, ?)', [company_id, name]);
};

exports.deleteService = (id) => {
  return db.query('DELETE FROM services WHERE id = ?', [id]);
};