const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const deliverable2Controller = require('../controllers/deliverable2Controller');
const { verifyToken, requireAdminWithActiveCompany, requireAdminOrManagerWithActiveCompany } = require('../middleware/auth');

router.use(verifyToken);

router.post('/', requireAdminWithActiveCompany, projectController.createFullProject);
router.get('/', requireAdminOrManagerWithActiveCompany, projectController.getProjectsList);
router.get('/allocations', requireAdminOrManagerWithActiveCompany, projectController.getAllocationsData);
router.get('/:id', requireAdminOrManagerWithActiveCompany, projectController.getProjectById);
router.put('/:id/quotation-deliverables/enable', requireAdminOrManagerWithActiveCompany, projectController.enableShowQuotationDeliverables);
router.post('/:id/deliverables-2/import-task-bundle', requireAdminOrManagerWithActiveCompany, deliverable2Controller.importBundleToDeliverable2);
router.put('/deliverables-2/:deliverable2Id/due-date', requireAdminOrManagerWithActiveCompany, deliverable2Controller.updateDeliverable2DueDate);
router.post('/:projectId/payments', requireAdminOrManagerWithActiveCompany, projectController.addReceivedPayment);
router.put('/:id/status', requireAdminOrManagerWithActiveCompany, projectController.updateProjectStatus);

router.put('/:id', requireAdminOrManagerWithActiveCompany, projectController.updateFullProject);
router.delete('/:id', requireAdminOrManagerWithActiveCompany, projectController.deleteProject);

module.exports = router;
