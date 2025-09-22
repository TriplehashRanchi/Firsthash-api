const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { verifyToken, requireAdminWithActiveCompany, requireAdminOrManagerWithActiveCompany } = require('../middleware/auth');

router.use(verifyToken);

router.post('/', requireAdminWithActiveCompany, projectController.createFullProject);
router.get('/', requireAdminOrManagerWithActiveCompany, projectController.getProjectsList);
router.get('/allocations', requireAdminOrManagerWithActiveCompany, projectController.getAllocationsData);
router.get('/:id', requireAdminOrManagerWithActiveCompany, projectController.getProjectById);
router.post('/:projectId/payments', requireAdminOrManagerWithActiveCompany, projectController.addReceivedPayment);
router.put('/:id/status', requireAdminOrManagerWithActiveCompany, projectController.updateProjectStatus);

router.put('/:id', requireAdminOrManagerWithActiveCompany, projectController.updateFullProject);
router.delete('/:id', requireAdminOrManagerWithActiveCompany, projectController.deleteProject);

module.exports = router;
