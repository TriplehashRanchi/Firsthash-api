// File: backend/routes/allExpensesRoutes.js  <-- CREATE THIS FILE

const express = require('express');
const router = express.Router();
const { getAllExpensesForDashboard } = require('../controllers/expenseController');
const { verifyToken, requireAdminWithActiveCompany } = require('../middleware/auth');

// GET /api/expenses/
// This single, efficient route gets all expenses for the company dashboard.
router.get('/', verifyToken, requireAdminWithActiveCompany, getAllExpensesForDashboard);

module.exports = router;