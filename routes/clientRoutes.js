// File: routes/clientRoutes.js

const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

// 📥 Get all clients for a company
// GET /api/clients?company_id=xxx
router.get('/', clientController.getClientsByCompany);

// 🔍 Search client by phone number
// GET /api/clients/search?phone=xxx&company_id=xxx
router.get('/search', clientController.searchClientByPhone);

// 📄 Get a single client by ID
// GET /api/clients/:id
router.get('/:id', clientController.getClientById);

// ➕ Create a new client
// POST /api/clients
router.post('/', clientController.createClient);

// 📝 Update a client
// PUT /api/clients/:id
router.put('/:id', clientController.updateClient);

// ❌ Delete a client
// DELETE /api/clients/:id
router.delete('/:id', clientController.deleteClient);

module.exports = router;
