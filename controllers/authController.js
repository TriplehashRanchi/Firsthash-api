// controllers/authController.js
const { v4: uuidv4 } = require('uuid');
const { createAdmin } = require('../models/adminModel');
const { createCompany, getCompanyByOwnerUid } = require('../models/companyModel');
const { getAdminByUID, getEmployeeByUID } = require('../models/userModel');

const getUserRole = async (req, res) => {
  const { firebase_uid } = req.params;

  if (!firebase_uid) {
    return res.status(400).json({ error: 'Missing UID' });
  }

  try {
    const admin = await getAdminByUID(firebase_uid);
    if (admin) {
      return res.status(200).json({
        role: 'admin',
        company_id: admin.company_id,
      });
    }

    // Employee check
    const employee = await getEmployeeByUID(firebase_uid);
    if (employee) {
      // If employee_type === 2 → return "manager"
      const roleName = employee.employee_type === 2 ? 'manager' : 'employee';

      return res.status(200).json({
        role: roleName,  // 👈 now could be "manager"
        company_id: employee.company_id,
        employee_type: employee.employee_type,
      });
    }

    return res.status(404).json({ error: 'User not found' });
  } catch (err) {
    console.error('Error determining user role:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};



const register = async (req, res) => {
  try {
    const { firebase_uid, email, name, phone, company_name } = req.body;

    if (!firebase_uid || !email || !company_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const company_id = uuidv4();

    await createCompany({
      id: company_id,
      name: company_name,
      owner_admin_uid: firebase_uid,
    });

    await createAdmin({
      firebase_uid,
      email,
      name: name || '',
      phone: phone || '',
      company_id,
    });

    res.status(201).json({ message: 'Registered successfully', company_id });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const registerWithGoogle = async (req, res) => {
  try {
    const { firebase_uid, email, name, phone, company_name } = req.body;

    if (!firebase_uid || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // check if company already exists
    const existingCompany = await getCompanyByOwnerUid(firebase_uid);
    if (existingCompany) {
      return res.status(200).json({
        message: 'User already registered',
        company_id: existingCompany.id,
      });
    }

    // create new company
    const company_id = uuidv4();
    await createCompany({
      id: company_id,
      name: company_name,
      owner_admin_uid: firebase_uid,
    });

    // create admin
    await createAdmin({
      firebase_uid,
      email,
      name: name || '',
      phone: phone || '',
      company_id,
    });

    res.status(201).json({ message: 'Google registration successful', company_id });
  } catch (error) {
    console.error('Google register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { register, registerWithGoogle, getUserRole };
