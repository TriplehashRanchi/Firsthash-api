// File: backend/controllers/memberController.js
const admin = require("../utils/admin"); // Firebase Admin SDK
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
  fetchAllAttendance,
  upsertAttendance,
  updateEmployeeSalary,
  fetchCompanySalaries,
  updateMonthlySalaryRecord,
  generateMonthlySalaryRecords
} = require("../models/memberModel");
// File: backend/controllers/memberController.js
const {
  upsertPaymentDetails: modelUpsertPaymentDetails
} = require('../models/memberModel');

const {
  sendWhatsAppsAccountActivated,
} = require("../utils/sendAiSensyMessage");


const GLOBAL_COMPANY_ID = "00000000-0000-0000-0000-000000000000";

// Create a new member
// File: backend/controllers/memberController.js
exports.createMember = async (req, res) => {
  try {
    const {
      member_type, // rename here
      role_ids,
      full_name,
      mobile_no,
      email,
      password,
      confirm_password,
      company_id// match the front-end
    } = req.body;

    console.log("👤 New member signup:", req.body);

    // — Validate only these fields —
    if (
      member_type == null ||
      !Array.isArray(role_ids) ||
      role_ids.length === 0 ||
      !full_name ||
      !mobile_no ||
      !email ||
      !password ||
      !confirm_password
    ) {
      return res.status(400).json({ error: "All signup fields are required." });
    }
    if (password !== confirm_password) {
      return res.status(400).json({ error: "Passwords must match." });
    }

    // 1️⃣ Create Firebase user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: full_name,
      phoneNumber: mobile_no.startsWith("+") ? mobile_no : `+91${mobile_no}`,
    });

    // 2️⃣ Set your custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      roleId: member_type,
      companyId: company_id,
    });

    console.log(company_id)

    // 3️⃣ Persist core employee
    const employee = await createEmployee({
      firebase_uid: userRecord.uid,
      employee_type: member_type,
      email,
      name: full_name,
      phone: mobile_no,
      company_id: company_id,
    });

    // 4️⃣ Batch‐assign all specific roles
    for (const rid of role_ids) {
      await assignRole({ firebase_uid: userRecord.uid, role_id: rid });
    }

    // 5️⃣ (Optional) send welcome WhatsApp
    sendWhatsAppsAccountActivated({
      name: full_name,
      company_name: company_id,
      phone: mobile_no,
    }).catch(console.error);

    return res.status(201).json({ employee });
  } catch (err) {
    console.error("createMember error:", err);
    if (err.code && err.code.startsWith("auth/")) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get all members
exports.getAllMembers = async (req, res) => {
  try {
    const company_id = req.company.id; // From middleware
    const members = await fetchAllEmployees(company_id);
    res.json(members);
  } catch (err) {
    console.error("getAllMembers error:", err.stack || err);
    res.status(500).json({ error: "Failed to load members" });
  }
};

// Get single member by UID
exports.getMemberById = async (req, res) => {
  try {
    const { uid } = req.params;
    const member = await fetchEmployeeByUid(uid);
    if (!member) return res.status(404).json({ error: "Member not found" });
    res.json(member);
  } catch (err) {
    console.error("getMemberById error:", err.stack || err);
    res.status(500).json({ error: "Failed to load member" });
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
      salary = null,
    } = req.body;

    // 1️⃣ Update core employee columns
    await editEmployee(uid, {
      name: full_name,
      email,
      phone,
      employee_type,
      address,
      salary: employee_type === 1 ? salary : null,
    });

    // 2️⃣ Update role assignment
    await removeRoleAssignments(uid);
    await assignRole({ firebase_uid: uid, role_id });

    // 3️⃣ Return updated record
    const updated = await fetchEmployeeByUid(uid);
    return res.json(updated);
  } catch (err) {
    console.error("updateMember error:", err.stack || err);
    return res.status(500).json({ error: "Failed to update member" });
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
    console.error("updateStatus error:", err.stack || err);
    res.status(500).json({ error: "Failed to update status" });
  }
};

// Delete a member
exports.deleteMember = async (req, res) => {
  try {
    const { uid } = req.params;
    await removeEmployee(uid);
    res.json({ success: true });
  } catch (err) {
    console.error("deleteMember error:", err.stack || err);
    res.status(500).json({ error: "Failed to delete member" });
  }
};

// Attendance records
exports.getAttendanceForMember = async (req, res) => {
  try {
    const { uid } = req.params;
    // This now calls the FIXED model function
    const records = await fetchAttendanceForUid(uid);
    res.json(records);
  } catch (err) {
    console.error("getAttendanceForMember error:", err.stack || err);
    res.status(500).json({ error: "Failed to load attendance" });
  }
};

exports.createOrUpdateAttendance = async (req, res) => {
    try {
        const records = req.body;
        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ error: 'Invalid payload. Expected an array of records.' });
        }
        await upsertAttendance(records);
        res.status(200).json({ message: 'Attendance saved successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ADD THIS NEW CONTROLLER FUNCTION
// Handles GET /api/members/attendance
exports.getAllAttendance = async (req, res) => {
    try {
        const records = await fetchAllAttendance();
        res.json(records);
    } catch (err) {
        console.error("getAllAttendance error:", err);
        res.status(500).json({ error: "Failed to load attendance records." });
    }
};


// Payment details
exports.getPaymentDetails = async (req, res) => {
  try {
    const { uid } = req.params;
    const details = await fetchPaymentDetails(uid);
    res.json(details);
  } catch (err) {
    console.error("getPaymentDetails error:", err.stack || err);
    res.status(500).json({ error: "Failed to load payment details" });
  }
};



// PUT /api/members/:uid/payment-details
exports.upsertPaymentDetails = async (req, res) => {
  try {
    const { uid } = req.params;
    console.log('📝 payment payload:', req.body);

    // Accept either camelCase or snake_case keys:
    const bank_name      = req.body.bank_name      ?? req.body.bankName      ?? null;
    const branch_name    = req.body.branch_name    ?? req.body.branchName    ?? null;
    const ifsc_code      = req.body.ifsc_code      ?? req.body.ifscCode      ?? null;
    const account_number = req.body.account_number ?? req.body.accountNumber ?? null;
    const account_holder = req.body.account_holder ?? req.body.accountHolder ?? null;
    const account_type   = req.body.account_type   ?? req.body.accountType   ?? null;
    const upi_id         = req.body.upi_id         ?? req.body.upiId         ?? null;

    // Now call the model; none of these will be undefined
    await modelUpsertPaymentDetails(uid, {
      bank_name,
      branch_name,
      ifsc_code,
      account_number,
      account_holder,
      account_type,
      upi_id
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('upsertPaymentDetails error:', err.stack || err);
    return res.status(500).json({ error: 'Failed to save payment details' });
  }
};


exports.deletePaymentDetails = async (req, res) => {
  try {
    const { uid } = req.params;
    await removePaymentDetails(uid);
    res.json({ success: true });
  } catch (err) {
    console.error("deletePaymentDetails error:", err.stack || err);
    res.status(500).json({ error: "Failed to delete payment details" });
  }
};


exports.updateBaseSalary = async (req, res) => {
  try {
    const { uid } = req.params; 
    const { salary } = req.body; 
    const company_id = req.company.id; 
    if (salary === undefined || isNaN(parseFloat(salary))) {
      return res.status(400).json({ error: 'A valid salary number is required.' });
    }
    await updateEmployeeSalary(uid, parseFloat(salary), company_id);
    res.json({ success: true, message: 'Base salary updated successfully.' });
  } catch (err) {
    console.error('updateBaseSalary error:', err);
    res.status(500).json({ error: 'Failed to update salary' });
  }
};

// NEW: Lists all generated monthly payroll records
exports.listMonthlySalaries = async (req, res) => {
  try {
    const company_id = req.company.id;
    const rows = await fetchCompanySalaries(company_id);
    res.json(rows);
  } catch (err) {
    console.error('listMonthlySalaries error:', err);
    res.status(500).json({ error: 'Failed to load monthly salaries' });
  }
};

// NEW: Updates a single monthly payroll record
exports.updateMonthlySalary = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount_paid, status, notes = null } = req.body;
    const company_id = req.company.id;
    await updateMonthlySalaryRecord({ id, company_id, amount_paid, status, notes });
    res.json({ success: true, message: 'Monthly record updated.' });
  } catch (err) {
    console.error('updateMonthlySalary error:', err);
    res.status(500).json({ error: 'Failed to update monthly salary' });
  }
};

// NEW: Generates payroll for a given month
exports.generateSalariesForMonth = async (req, res) => {
  try {
    const { month, year } = req.body;
    const company_id = req.company.id;
    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year are required.' });
    }
    const result = await generateMonthlySalaryRecords(company_id, month, year);
    res.status(201).json({
      message: `Successfully generated/updated salaries for ${month}/${year}.`,
      affectedRows: result.affectedRows
    });
  } catch (err) {
    console.error('generateSalariesForMonth error:', err);
    res.status(500).json({ error: 'Failed to generate salary records.' });
  }
};