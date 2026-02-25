const express = require('express');
const router = express.Router();

const billingController = require('../controllers/billingController');
const { verifyToken, requireAdminOrManagerWithActiveCompany } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireAdminOrManagerWithActiveCompany);

router.get('/invoices', billingController.getInvoices);
router.get('/invoices/:paymentId', billingController.getInvoiceById);
router.get('/summary', billingController.getSummary);
router.get('/projects/search', billingController.searchProjects);
router.post('/invoices', billingController.createInvoice);
router.put('/invoices/:paymentId/mark-as-paid', billingController.markInvoiceAsPaid);

module.exports = router;
