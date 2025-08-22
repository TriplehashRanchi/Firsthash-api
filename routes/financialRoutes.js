const express = require('express');
const router = express.Router({ mergeParams: true });
const { generateBill, generateFullPaidBill, markPaymentAsPaid } = require('../controllers/financialsController');

const { verifyToken, requireAdminWithActiveCompany, requireAdminOrManagerWithActiveCompany } = require('../middleware/auth');

router.use(verifyToken);

// Generate PDF Bill Report
router.post('/projects/:projectId/report', requireAdminOrManagerWithActiveCompany, generateBill);

// New route for generating a bill with a "Full Paid" watermark
// router.post('/projects/:projectId/full-paid-report', verifyToken, requireAdminWithActiveCompany, generateFullPaidBill);

router.put('/payments/:paymentId/mark-as-paid',  requireAdminOrManagerWithActiveCompany, markPaymentAsPaid);

module.exports = router;
