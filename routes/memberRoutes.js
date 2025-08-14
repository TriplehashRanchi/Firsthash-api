// File: backend/routes/memberRoutes.js
const express = require('express');
const router = express.Router();
const {
  createMember,
  getAllMembers,
  getMemberById,
  updateMember,
  updateStatus,
  deleteMember,
  getAllAttendance,
  createOrUpdateAttendance,
  getAttendanceForMember,
  getPaymentDetails,
  upsertPaymentDetails,
  deletePaymentDetails,
  generateSalariesForMonth,
  listMonthlySalaries,
  updateMonthlySalary,
  updateBaseSalary,
  getSalaryHistoryForEmployee,
  paySalaryForSingleMonth,  // <-- Import new controller
  payAllDueSalaries ,
  getFreelancerSummaries,
  addFreelancerPayment,
  getFreelancerHistory,
  getUnbilledAssignments,
  billFreelancerAssignment,
  

} = require('../controllers/memberController');

const { verifyToken, requireAdminWithActiveCompany } = require('../middleware/auth');

// Protect *all* member routes below:
router.use(verifyToken, requireAdminWithActiveCompany);

router.get('/freelancers/summaries', getFreelancerSummaries);
router.get('/freelancers/:uid/unbilled-assignments', getUnbilledAssignments);
router.post('/freelancers/billings', billFreelancerAssignment); // Use POST for creating a new billing record
router.get('/freelancers/:uid/history', getFreelancerHistory);
router.post('/freelancers/payments', addFreelancerPayment);

// --- MEMBER SPECIFIC ROUTES ---
// — Salaries dashboard —
router.post('/salaries/generate', generateSalariesForMonth);
router.get('/salaries', listMonthlySalaries);
router.put('/salaries/:id', updateMonthlySalary);
// — Attendance dashboard —
router.post('/attendance',           createOrUpdateAttendance);
router.get('/attendance',            getAllAttendance);


// — Member CRUD —
router.post('/',                     createMember);
router.get('/',                      getAllMembers);
router.put('/:uid/salary',           updateBaseSalary);
router.get('/:uid',                  getMemberById);
router.put('/:uid',                  updateMember);
router.patch('/:uid/status',         updateStatus);
router.delete('/:uid',               deleteMember);

// — Per-member attendance & payments —
router.get('/:uid/attendance',       getAttendanceForMember);
router.get('/:uid/payment-details',  getPaymentDetails);
router.put('/:uid/payment-details',  upsertPaymentDetails);
router.delete('/:uid/payment-details', deletePaymentDetails);

// NEW: Routes for handling payments from the history modal
router.post('/salaries/pay-single', paySalaryForSingleMonth);
router.post('/salaries/pay-all-due', payAllDueSalaries);

router.get('/:uid/salaries/history', getSalaryHistoryForEmployee);


module.exports = router;
