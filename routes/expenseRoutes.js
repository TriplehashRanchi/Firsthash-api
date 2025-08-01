// File: routes/expenseRoutes.js
const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams is important for nested routes
const { createExpense, updateExpense, deleteExpense } = require('../controllers/expenseController');
const {  verifyToken, requireAdminWithActiveCompany } = require('../middleware/auth');

router.post('/', verifyToken, requireAdminWithActiveCompany, createExpense);
router.route('/:expenseId').put(verifyToken, requireAdminWithActiveCompany, updateExpense).delete(verifyToken, requireAdminWithActiveCompany, deleteExpense);

module.exports = router;