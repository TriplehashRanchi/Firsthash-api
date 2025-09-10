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
  generateMonthlySalaryRecords,
  fetchSalaryHistoryForEmployee,
  paySingleMonthSalary,
  payAllDueSalariesForEmployee,
  fetchFreelancerSummaries,
  createFreelancerPayment,
  fetchFreelancerHistory,
  fetchUnbilledAssignmentsForFreelancer,
  billAssignment,
  ensureAbsentMarked
  
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
      member_type,    // 0 = freelancer, 1 = in-house, 2 = manager
      role_ids = [],
      full_name,
      mobile_no,
      alternate_phone,
      email,
      password,
      confirm_password,
      company_id
    } = req.body;

    console.log("👤 New member signup:", req.body);

    // Basic validations
    if (
      member_type == null ||
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

    // Special rule: if not manager, must provide role_ids
    if (parseInt(member_type) !== 2 && (!Array.isArray(role_ids) || role_ids.length === 0)) {
      return res.status(400).json({ error: "At least one role must be assigned for non-manager members." });
    }

    // 1️⃣ Create Firebase user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: full_name,
      phoneNumber: mobile_no.startsWith("+") ? mobile_no : `+91${mobile_no}`,
    });

    // 2️⃣ Set custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      roleId: member_type,
      companyId: company_id,
    });

    // 3️⃣ Save in DB
    const employee = await createEmployee({
      firebase_uid: userRecord.uid,
      employee_type: member_type,
      email,
      name: full_name,
      phone: mobile_no,
      alternate_phone: alternate_phone || null,
      company_id,
    });

    // 4️⃣ Assign roles only if not a manager
    if (parseInt(member_type) !== 2 && role_ids.length > 0) {
      for (const rid of role_ids) {
        await assignRole({ firebase_uid: userRecord.uid, role_id: rid });
      }
    }

    // 5️⃣ Send WhatsApp notification
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
      alternate_phone,
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
      alternate_phone: alternate_phone || null,
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
    const today = new Date().toISOString().slice(0, 10);

    // Ensure at least today is marked
    await ensureAbsentMarked(req.company.id, today);

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

exports.getSalaryHistoryForEmployee = async (req, res) => {
  try {
    const { uid } = req.params; // The employee's firebase_uid from the URL
    const company_id = req.company.id; // From your auth middleware

    const history = await fetchSalaryHistoryForEmployee(uid, company_id);
    
    // The model will return an array, which could be empty. This is expected.
    res.json(history);

  } catch (err) {
    console.error('getSalaryHistoryForEmployee error:', err);
    res.status(500).json({ error: 'Failed to load salary history.' });
  }
};


exports.paySalaryForSingleMonth = async (req, res) => {
  try {
    const { salaryId } = req.body;
    const company_id = req.company.id; // From middleware

    if (!salaryId) {
      return res.status(400).json({ error: 'Salary record ID is required.' });
    }

    const result = await paySingleMonthSalary(salaryId, company_id);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Salary record not found or you do not have permission to update it.' });
    }

    res.json({ success: true, message: 'Payment for the month recorded successfully.' });
  } catch (err) {
    console.error('paySalaryForSingleMonth error:', err);
    res.status(500).json({ error: 'Failed to record payment.' });
  }
};

// NEW: Controller to pay all outstanding dues for an employee
exports.payAllDueSalaries = async (req, res) => {
  try {
    const { employeeUid } = req.body;
    const company_id = req.company.id; // From middleware

    if (!employeeUid) {
      return res.status(400).json({ error: 'Employee UID is required.' });
    }

    await payAllDueSalariesForEmployee(employeeUid, company_id);

    res.json({ success: true, message: 'All due payments have been recorded successfully.' });
  } catch (err) {
    console.error('payAllDueSalaries error:', err);
    res.status(500).json({ error: 'Failed to record payments.' });
  }
};

// Controller to get all freelancers with their financial summaries
exports.getFreelancerSummaries = async (req, res) => {
    try {
        const company_id = req.company.id; // From middleware
        const summaries = await fetchFreelancerSummaries(company_id);
        res.json(summaries);
    } catch (err) {
        console.error('getFreelancerSummaries error:', err);
        res.status(500).json({ error: 'Failed to load freelancer summaries.' });
    }
};
// Controller to record a payment to a freelancer
exports.addFreelancerPayment = async (req, res) => {
    const { freelancer_uid, payment_amount, notes } = req.body;
    if (!freelancer_uid || !payment_amount) {
        return res.status(400).json({ error: 'Freelancer UID and payment amount are required.' });
    }
    try {
        await createFreelancerPayment({ freelancer_uid, payment_amount, notes });
        res.status(201).json({ message: 'Payment recorded successfully.' });
    } catch (err) {
        console.error('addFreelancerPayment error:', err);
        res.status(500).json({ error: 'Failed to record payment.' });
    }
};

exports.getUnbilledAssignments = async (req, res) => {
    try {
        const { uid } = req.params;
        const assignments = await fetchUnbilledAssignmentsForFreelancer(uid);
        res.json(assignments);
    } catch (err) { 
        console.error('getUnbilledAssignments error:', err);
        res.status(500).json({ error: 'Failed to load unbilled assignments.' });
     }
};

exports.billFreelancerAssignment = async (req, res) => {
    // The assignment_id might be a composite key like 'task_id-uid' or a simple ID
    const { freelancer_uid, assignment_type, assignment_id, fee } = req.body;
    const company_id = req.company.id;
    if (!freelancer_uid || !assignment_type || !assignment_id || !fee) {
        return res.status(400).json({ error: 'All fields are required to bill an assignment.' });
    }
    try {
        // The model expects a simple integer ID. We get this from the body.
        await billAssignment({ freelancer_uid, assignment_type, assignment_id, fee, company_id });
        res.status(201).json({ message: 'Assignment has been billed successfully.' });
    }catch (err) { 
        console.error('billFreelancerAssignment error:', err);
        res.status(500).json({ error: 'Failed to bill assignment.' });
     }
};

exports.getFreelancerHistory = async (req, res) => {
    try {
        const { uid } = req.params;
        const history = await fetchFreelancerHistory(uid);
        res.json(history);
    } catch (err) { 
        console.error('getFreelancerHistory error:', err);
        res.status(500).json({ error: 'Failed to load freelancer history.' });
     }
};