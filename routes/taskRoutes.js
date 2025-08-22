// File: routes/taskRoutes.js
const express = require('express');
const router = express.Router();
const { getTasks, createTask, updateTaskAssignees, updateTask, deleteTask } = require('../controllers/taskController');

const { verifyToken, requireAdminWithActiveCompany, requireAdminOrManagerWithActiveCompany } = require('../middleware/auth');


router.get('/', verifyToken, requireAdminOrManagerWithActiveCompany, getTasks);

router.post('/', verifyToken, requireAdminOrManagerWithActiveCompany, createTask);
router.put('/:id', verifyToken, requireAdminOrManagerWithActiveCompany, updateTask);
router.put('/:id/assignees', verifyToken, requireAdminOrManagerWithActiveCompany, updateTaskAssignees);
router.delete('/:id', verifyToken, requireAdminWithActiveCompany, deleteTask);




module.exports = router;