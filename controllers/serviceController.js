
// File: controllers/serviceController.js
const serviceModel = require('../models/serviceModel');

exports.getServices = async (req, res) => {
  const { company_id } = req.query;
  if (!company_id) return res.status(400).json({ error: 'Missing company_id' });
  const [rows] = await serviceModel.getServicesByCompany(company_id);
  res.json(rows);
};

exports.addService = async (req, res) => {
  const { company_id, name } = req.body;
  if (!company_id || !name) return res.status(400).json({ error: 'Missing fields' });
  await serviceModel.addService(company_id, name);
  res.json({ success: true });
};

exports.deleteService = async (req, res) => {
  const { id } = req.params;
  await serviceModel.deleteService(id);
  res.json({ success: true });
};