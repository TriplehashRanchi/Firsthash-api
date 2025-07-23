/*
File: backend/controllers/roleController.js
Description: HTTP handlers for role endpoints
*/

const {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
} = require('../models/rolesModel');

// A constant to define which IDs are predefined and protected
const PREDEFINED_ROLE_IDS_MAX = 13;

// GET /api/roles?company_id=<uuid>
exports.listRoles = async (req, res) => {
  try {
    const companyId = req.query.company_id || '00000000-0000-0000-0000-000000000000';
    const roles = await getAllRoles(companyId);
    res.json(roles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/roles/:id
exports.getRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await getRoleById(id);
    if (!role) return res.status(404).json({ error: 'Role not found' });
    res.json(role);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/roles
exports.createRole = async (req, res) => {
  try {
    const { type_name, role_code, company_id } = req.body;
    if (!type_name || role_code == null || !company_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const newRole = await createRole({ type_name, role_code, company_id });
    res.status(201).json(newRole);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /api/roles/:id
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ SERVER-SIDE PROTECTION
    if (parseInt(id, 10) <= PREDEFINED_ROLE_IDS_MAX) {
      return res.status(403).json({ error: 'Predefined roles cannot be modified.' });
    }

    const { type_name, role_code } = req.body;
    const updated = await updateRole(id, { type_name, role_code });
    if (!updated) {
        return res.status(404).json({ error: 'Role not found for update.' });
    }
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/roles/:id
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ SERVER-SIDE PROTECTION
    if (parseInt(id, 10) <= PREDEFINED_ROLE_IDS_MAX) {
      return res.status(403).json({ error: 'Predefined roles cannot be deleted.' });
    }

    await deleteRole(id);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};