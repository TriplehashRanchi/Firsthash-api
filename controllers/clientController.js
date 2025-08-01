// File: controllers/clientController.js

const clientModel = require('../models/clientModel');

// ✅ Get all clients by company
const getClientsByCompany = async (req, res) => {
  const { company_id } = req.query;
  if (!company_id) return res.status(400).json({ error: 'Missing company_id' });

  try {
    const clients = await clientModel.getClientsByCompany(company_id);
    res.json(clients);
  } catch (err) {
    console.error('Error fetching clients:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ✅ Get client by ID
const getClientById = async (req, res) => {
  const { id } = req.params;
  try {
    const client = await clientModel.getClientById(id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (err) {
    console.error('Error fetching client by ID:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ✅ Search client by phone
const searchClientByPhone = async (req, res) => {
  const { phone, company_id } = req.query;
  if (!phone || !company_id) {
    return res.status(400).json({ error: 'Missing phone or company_id' });
  }

  try {
    const client = await clientModel.getClientByPhone(phone, company_id);
    if (!client) return res.json({ found: false });
    return res.json({ found: true, client });
  } catch (err) {
    console.error('Error searching client by phone:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ✅ Create a new client
const createClient = async (req, res) => {
  try {
    const clientId = await clientModel.createClient(req.body);
    res.status(201).json({ client_id: clientId });
  } catch (err) {
    console.error('Error creating client:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ✅ Update client
const updateClient = async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await clientModel.updateClient(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Client not found or no changes' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating client:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ✅ Delete client
const deleteClient = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await clientModel.deleteClient(id);
    if (!deleted) return res.status(404).json({ error: 'Client not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting client:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getClientsByCompany,
  getClientById,
  searchClientByPhone,
  createClient,
  updateClient,
  deleteClient,
};