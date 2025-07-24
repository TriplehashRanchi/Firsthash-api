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
  getAttendanceForMember,
  getPaymentDetails,
  upsertPaymentDetails,
  deletePaymentDetails,
  getAllAttendance,
  createOrUpdateAttendance,

} = require('../controllers/memberController');
const { requireAdminWithActiveCompany, verifyToken } = require('../middleware/auth');

router.post('/attendance', createOrUpdateAttendance); // Handles saving attendance
router.get('/attendance', getAllAttendance);       // Handles getting all attendance for the dashboard


router.post('/', verifyToken, requireAdminWithActiveCompany,  createMember);
router.get('/',                 getAllMembers);
router.get('/:uid',             getMemberById);
router.put('/:uid',             updateMember);
router.patch('/:uid/status',    updateStatus);
router.delete('/:uid',          deleteMember);
router.get('/:uid/attendance',  getAttendanceForMember);
router.get('/:uid/payment-details', getPaymentDetails);
router.put('/:uid/payment-details', upsertPaymentDetails);
router.delete('/:uid/payment-details', deletePaymentDetails);


module.exports = router;
