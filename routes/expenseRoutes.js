// File: backend/routes/expenseRoutes.js
// PURPOSE: Handles routes for expenses belonging to a SINGLE project.

const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams is essential
const { createExpense, updateExpense, deleteExpense } = require('../controllers/expenseController');
const { verifyToken, requireAdminWithActiveCompany, requireAdminOrManagerWithActiveCompany } = require('../middleware/auth');

// POST /api/projects/:projectId/expenses/
// Creates a new expense for the given project.
router.post('/', verifyToken, requireAdminWithActiveCompany, createExpense);

// PUT & DELETE /api/projects/:projectId/expenses/:expenseId
// Updates or deletes a specific expense.
router.route('/:expenseId')
    .put(verifyToken, requireAdminOrManagerWithActiveCompany, updateExpense)
    .delete(verifyToken, requireAdminWithActiveCompany, deleteExpense);

module.exports = router;