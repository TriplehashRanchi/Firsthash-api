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
  updateBaseSalary
} = require('../controllers/memberController');

const { verifyToken, requireAdminWithActiveCompany } = require('../middleware/auth');

// Protect *all* member routes below:
router.use(verifyToken, requireAdminWithActiveCompany);
router.post('/salaries/generate', generateSalariesForMonth);
router.get('/salaries', listMonthlySalaries);
router.put('/salaries/:id', updateMonthlySalary);
// — Attendance dashboard —
router.post('/attendance',           createOrUpdateAttendance);
router.get('/attendance',            getAllAttendance);


// — Member CRUD —
router.post('/',                     createMember);
router.get('/',                      getAllMembers);
router.put('/:uid/salary', updateBaseSalary);
router.get('/:uid',                  getMemberById);
router.put('/:uid',                  updateMember);
router.patch('/:uid/status',         updateStatus);
router.delete('/:uid',               deleteMember);

// — Per-member attendance & payments —
router.get('/:uid/attendance',       getAttendanceForMember);
router.get('/:uid/payment-details',  getPaymentDetails);
router.put('/:uid/payment-details',  upsertPaymentDetails);
router.delete('/:uid/payment-details', deletePaymentDetails);

module.exports = router;
