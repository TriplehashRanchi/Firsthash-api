// File: backend/controllers/memberController.js
const admin = require('../utils/admin');               // Firebase Admin SDK
const {
  createEmployee,
  assignRole,
  fetchAllEmployees,
  fetchEmployeeByUid,
  editEmployee,
  removeEmployee,
  fetchAttendanceForUid,
  removeRoleAssignments,
  fetchPaymentDetails,
  upsertPaymentDetails
} = require('../models/memberModel');
const { sendWhatsAppsAccountActivated } = require('../utils/sendAiSensyMessage');

const GLOBAL_COMPANY_ID = '00000000-0000-0000-0000-000000000000';

// Create a new member
exports.createMember = async (req, res) => {
  try {
    const {
      member_type,     // role_id from dropdown
      full_name,
      mobile_no,
      email,
      password,
      employee_type,   // 0 or 1
      address = null,
      salary = null
    } = req.body;

    // Basic validation
    if (
      member_type == null ||
      !full_name ||
      !mobile_no ||
      !email ||
      !password ||
      (employee_type !== 0 && employee_type !== 1)
    ) {
      return res.status(400).json({ error: 'Missing or invalid required fields' });
    }

    // 1️⃣ Create the Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: full_name,
      phoneNumber: mobile_no.startsWith('+') ? mobile_no : `+91${mobile_no}`
    });

    // 2️⃣ Set custom claims for role-based access
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      roleId: member_type,
      companyId: GLOBAL_COMPANY_ID,
      employeeType: employee_type
    });

    // 3️⃣ Persist in your own MySQL DB, include address and salary
    const employee = await createEmployee({
      firebase_uid: userRecord.uid,
      email,
      name: full_name,
      phone: mobile_no,
      company_id: GLOBAL_COMPANY_ID,
      employee_type,
      status: 'active',
      address,
      salary: employee_type === 1 ? salary : null,
      password
    });

    // 4️⃣ Assign business role
    const assignment = await assignRole({
      firebase_uid: userRecord.uid,
      role_id: member_type
    });

    // 5️⃣ Send WhatsApp welcome message
    try {
      await sendWhatsAppsAccountActivated({
        name: full_name,
        company_name: GLOBAL_COMPANY_ID,
        phone: mobile_no,
      });
    } catch (whErr) {
      console.error('WhatsApp send error:', whErr);
    }

    // 6️⃣ Response
    res.status(201).json({ employee, assignment });
  } catch (err) {
    console.error('createMember error:', err.stack || err);
    if (err.code === 'auth/email-already-exists' || err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all members
exports.getAllMembers = async (req, res) => {
  try {
    const members = await fetchAllEmployees();
    res.json(members);
  } catch (err) {
    console.error('getAllMembers error:', err.stack || err);
    res.status(500).json({ error: 'Failed to load members' });
  }
};

// Get single member by UID
exports.getMemberById = async (req, res) => {
  try {
    const { uid } = req.params;
    const member = await fetchEmployeeByUid(uid);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    res.json(member);
  } catch (err) {
    console.error('getMemberById error:', err.stack || err);
    res.status(500).json({ error: 'Failed to load member' });
  }
};

// Update member core details
exports.updateMember = async (req, res) => {
  try {
    const { uid } = req.params;
    const {
      full_name,
      email,
      phone,
      employee_type,
      role_id,
      address = null,
      salary = null
    } = req.body;

    // 1️⃣ Update core employee columns
    await editEmployee(uid, {
      name: full_name,
      email,
      phone,
      employee_type,
      address,
      salary: employee_type === 1 ? salary : null
    });

    // 2️⃣ Update role assignment
    await removeRoleAssignments(uid);
    await assignRole({ firebase_uid: uid, role_id });

    // 3️⃣ Return updated record
    const updated = await fetchEmployeeByUid(uid);
    return res.json(updated);
  } catch (err) {
    console.error('updateMember error:', err.stack || err);
    return res.status(500).json({ error: 'Failed to update member' });
  }
};

// Toggle user active status
exports.updateStatus = async (req, res) => {
  try {
    const { uid } = req.params;
    const { status } = req.body;
    const updated = await editEmployee(uid, { status });
    res.json(updated);
  } catch (err) {
    console.error('updateStatus error:', err.stack || err);
    res.status(500).json({ error: 'Failed to update status' });
  }
};

// Delete a member
exports.deleteMember = async (req, res) => {
  try {
    const { uid } = req.params;
    await removeEmployee(uid);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteMember error:', err.stack || err);
    res.status(500).json({ error: 'Failed to delete member' });
  }
};

// Attendance records
exports.getAttendanceForMember = async (req, res) => {
  try {
    const { uid } = req.params;
    const records = await fetchAttendanceForUid(uid);
    res.json(records);
  } catch (err) {
    console.error('getAttendanceForMember error:', err.stack || err);
    res.status(500).json({ error: 'Failed to load attendance' });
  }
};

// Payment details
exports.getPaymentDetails = async (req, res) => {
  try {
    const { uid } = req.params;
    const details = await fetchPaymentDetails(uid);
    res.json(details);
  } catch (err) {
    console.error('getPaymentDetails error:', err.stack || err);
    res.status(500).json({ error: 'Failed to load payment details' });
  }
};

exports.upsertPaymentDetails = async (req, res) => {
  try {
    const { uid } = req.params;
    await upsertPaymentDetails(uid, req.body);
    res.json({ success: true });
  } catch (err) {
    console.error('upsertPaymentDetails error:', err.stack || err);
    res.status(500).json({ error: 'Failed to save payment details' });
  }
};

exports.deletePaymentDetails = async (req, res) => {
  try {
    const { uid } = req.params;
    await removePaymentDetails(uid);
    res.json({ success: true });
  } catch (err) {
    console.error('deletePaymentDetails error:', err.stack || err);
    res.status(500).json({ error: 'Failed to delete payment details' });
  }
};