// File: models/eventModel.js
const db = require('../config/db');

exports.getEventTitlesByCompany = (company_id) => {
  return db.query('SELECT id, title FROM event_titles WHERE company_id = ? ORDER BY title ASC', [company_id]);
};

exports.addEventTitle = (company_id, title) => {
  return db.query('INSERT IGNORE INTO event_titles (company_id, title) VALUES (?, ?)', [company_id, title]);
};

exports.deleteEventTitle = (id) => {
  return db.query('DELETE FROM event_titles WHERE id = ?', [id]);
};
