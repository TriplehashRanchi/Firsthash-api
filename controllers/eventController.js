// File: controllers/eventController.js
const eventModel = require('../models/eventModel');

exports.getEventTitles = async (req, res) => {
  const { company_id } = req.query;
  if (!company_id) return res.status(400).json({ error: 'Missing company_id' });
  const [rows] = await eventModel.getEventTitlesByCompany(company_id);
  res.json(rows);
};

exports.addEventTitle = async (req, res) => {
  const { company_id, title } = req.body;
  if (!company_id || !title) return res.status(400).json({ error: 'Missing fields' });
  await eventModel.addEventTitle(company_id, title);
  res.json({ success: true });
};

exports.deleteEventTitle = async (req, res) => {
  const { id } = req.params;
  await eventModel.deleteEventTitle(id);
  res.json({ success: true });
};
