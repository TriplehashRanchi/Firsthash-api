const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { verifyToken, requireAdminWithActiveCompany } = require('../middleware/auth');

router.post('/', verifyToken, requireAdminWithActiveCompany, projectController.createFullProject);
router.get('/', verifyToken, requireAdminWithActiveCompany, projectController.getProjectsList);
router.get('/:id', verifyToken, requireAdminWithActiveCompany, projectController.getProjectById);

module.exports = router;
