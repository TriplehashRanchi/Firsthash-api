// File: routes/taskRoutes.js
const express = require('express');
const router = express.Router();
const { createTask, updateTaskAssignees, updateTask, deleteTask } = require('../controllers/taskController');
const { verifyToken, requireAdminWithActiveCompany } = require('../middleware/auth');



// @route   POST /api/tasks
// @desc    Create a new task
// @access  Private
router.post('/', verifyToken, requireAdminWithActiveCompany, createTask);
router.put('/:id', verifyToken, requireAdminWithActiveCompany, updateTask);
router.put('/:id/assignees', verifyToken, requireAdminWithActiveCompany, updateTaskAssignees);
router.delete('/:id', verifyToken, requireAdminWithActiveCompany, deleteTask);

module.exports = router;