// backend/routes/employeeRoutes.js
const express = require('express');
const router = express.Router();

const employeeCtrl = require('../controllers/employeeController');
const { verifyToken, requireEmployeeWithActiveCompany } = require('../middleware/auth');


router.use(verifyToken, requireEmployeeWithActiveCompany);

// ---- EMPLOYEE (read-only) ----
router.get('/tasks/assigned',  employeeCtrl.getMyTasks);
router.get('/projects/assigned',  employeeCtrl.getMyProjects);
router.get('/projects/:id/view', employeeCtrl.viewProjectById);

// ✅ ADD: New endpoint to get all custom statuses for the company
router.get('/tasks/custom-statuses', employeeCtrl.getCustomTaskStatuses);

// ✅ ADD: New endpoint for an employee to update a task's status
router.put('/tasks/:id/status', employeeCtrl.updateMyTaskStatus);

// ✅ ADD THESE NEW ROUTES
router.get('/salary/history', employeeCtrl.getMySalaryHistory);
router.get('/salary/summary', employeeCtrl.getMySalarySummary);
router.get('/expenses', employeeCtrl.getMyExpenses);

module.exports = router;
