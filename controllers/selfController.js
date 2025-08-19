// backend/controllers/selfController.js
const { fetchEmployeeByUid, fetchPaymentDetails, upsertPaymentDetails, } = require('../models/memberModel');

/**
 * GET /api/self/profile
 * Requires verifyToken (uses req.firebase_uid set by your middleware)
 */
exports.getMyProfile = async (req, res) => {
  try {
    const uid = req.firebase_uid; // set in verifyToken
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    const employee = await fetchEmployeeByUid(uid);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    // Only expose safe fields
    const safe = {
      firebase_uid: employee.firebase_uid,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      employee_type: employee.employee_type, // 0=freelancer, 1=in-house, 2=manager
      status: employee.status,
      address: employee.address ?? null,
      salary: employee.salary ?? null,
      roles: employee.roles ?? [],
    };

    res.json(safe);
  } catch (err) {
    console.error('getMyProfile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/self/payment-details
 * Requires verifyToken
 * Only bank details, no QR or extra fields.
 */
exports.getMyPaymentDetails = async (req, res) => {
  try {
    const uid = req.firebase_uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    const details = await fetchPaymentDetails(uid);
    // Only send bank details related fields
    const bank = {
      bank_name: details.bank_name ?? '',
      branch_name: details.branch_name ?? '',
      ifsc_code: details.ifsc_code ?? '',
      account_number: details.account_number ?? '',
      account_holder: details.account_holder ?? '',
      account_type: details.account_type ?? '',
      upi_id: details.upi_id ?? '',
    };
    res.json(bank);
  } catch (err) {
    console.error('getMyPaymentDetails error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


exports.updateMyProfile = async (req, res) => {
  try {
    const uid = req.firebase_uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    // only allow these fields to be updated by employee
    const { name, phone, address } = req.body || {};
    if (name == null && phone == null && address == null) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    // Reuse your editEmployee model via a local call pattern:
    const pool = require('../config/db');
    const fields = [];
    const params = [];

    if (name != null) { fields.push('name = ?'); params.push(name); }
    if (phone != null) { fields.push('phone = ?'); params.push(phone); }
    if (address != null) { fields.push('address = ?'); params.push(address); }
    params.push(uid);

    await pool.execute(`UPDATE employees SET ${fields.join(', ')} WHERE firebase_uid = ?`, params);

    const updated = await fetchEmployeeByUid(uid);
    // Return only safe subset
    const safe = {
      firebase_uid: updated.firebase_uid,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      employee_type: updated.employee_type,
      status: updated.status,
      address: updated.address ?? null,
      salary: updated.salary ?? null,
      roles: updated.roles ?? [],
    };
    res.json(safe);
  } catch (err) {
    console.error('updateMyProfile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
};

// PUT /api/self/payment-details
exports.updateMyPaymentDetails = async (req, res) => {
  try {
    const uid = req.firebase_uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    const {
      bank_name      = null,
      branch_name    = null,
      ifsc_code      = null,
      account_number = null,
      account_holder = null,
      account_type   = null,
      upi_id         = null
    } = req.body || {};

    await upsertPaymentDetails(uid, {
      bank_name,
      branch_name,
      ifsc_code,
      account_number,
      account_holder,
      account_type,
      upi_id
    });

    res.json({ success: true });
  } catch (err) {
    console.error('updateMyPaymentDetails error:', err);
    res.status(500).json({ error: 'Failed to update bank details.' });
  }
};