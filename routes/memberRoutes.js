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
  paySalaryForSingleMonth,
  payAllDueSalaries,
  getFreelancerSummaries,
  addFreelancerPayment,
  getFreelancerHistory,
  getUnbilledAssignments,
  billFreelancerAssignment,
} = require('../controllers/memberController');

const { verifyToken, requireAdminWithActiveCompany, requireAdminOrManagerWithActiveCompany } = require('../middleware/auth');

// ✅ Step 1: apply verifyToken to all routes
router.use(verifyToken);

// --- Freelancers (admin-only) ---
router.get('/freelancers/summaries', requireAdminWithActiveCompany, getFreelancerSummaries);
router.get('/freelancers/:uid/unbilled-assignments', requireAdminWithActiveCompany, getUnbilledAssignments);
router.post('/freelancers/billings', requireAdminWithActiveCompany, billFreelancerAssignment);
router.get('/freelancers/:uid/history', requireAdminWithActiveCompany, getFreelancerHistory);
router.post('/freelancers/payments', requireAdminWithActiveCompany, addFreelancerPayment);

// --- Salaries (admin-only) ---
router.post('/salaries/generate', requireAdminWithActiveCompany, generateSalariesForMonth);
router.get('/salaries', requireAdminWithActiveCompany, listMonthlySalaries);
router.put('/salaries/:id', requireAdminWithActiveCompany, updateMonthlySalary);
router.post('/salaries/pay-single', requireAdminWithActiveCompany, paySalaryForSingleMonth);
router.post('/salaries/pay-all-due', requireAdminWithActiveCompany, payAllDueSalaries);

// --- Attendance (admin OR manager) ---
router.post('/attendance', requireAdminOrManagerWithActiveCompany, createOrUpdateAttendance);
router.get('/attendance', requireAdminOrManagerWithActiveCompany, getAllAttendance);

// --- Members CRUD ---
router.post('/', requireAdminWithActiveCompany, createMember); // only admins can onboard members
router.get('/', requireAdminOrManagerWithActiveCompany, getAllMembers);
router.put('/:uid/salary', requireAdminWithActiveCompany, updateBaseSalary);
router.get('/:uid', requireAdminOrManagerWithActiveCompany, getMemberById);
router.put('/:uid', requireAdminWithActiveCompany, updateMember);
router.patch('/:uid/status', requireAdminWithActiveCompany, updateStatus);
router.delete('/:uid', requireAdminWithActiveCompany, deleteMember);

// --- Per-member attendance & payments ---
router.get('/:uid/attendance', requireAdminOrManagerWithActiveCompany, getAttendanceForMember);
router.get('/:uid/payment-details', requireAdminWithActiveCompany, getPaymentDetails);
router.put('/:uid/payment-details', requireAdminWithActiveCompany, upsertPaymentDetails);
router.delete('/:uid/payment-details', requireAdminWithActiveCompany, deletePaymentDetails);

// --- Salary history ---
router.get('/:uid/salaries/history', requireAdminOrManagerWithActiveCompany, getSalaryHistoryForEmployee);

module.exports = router;
