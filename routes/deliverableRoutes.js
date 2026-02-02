const express = require('express');
const router = express.Router();
const  { getDeliverables } = require('../controllers/deliverableController');
const { verifyToken, requireAdminWithActiveCompany, requireAdminOrManagerWithActiveCompany } = require('../middleware/auth');

const deliverableController = require('../controllers/deliverableController');
const taskBundleController = require('../controllers/taskBundleController');

// ------- Templates -------
router.get('/templates', deliverableController.getTemplates);
router.post('/templates', deliverableController.addTemplate);
router.delete('/templates', deliverableController.deleteTemplate);

// ------- Bundles -------
router.get('/bundles', deliverableController.getBundles);
router.post('/bundles', deliverableController.addBundle);
router.delete('/bundles', deliverableController.deleteBundle);
// --- ADD THIS NEW ROUTE ---
router.put('/bundles', deliverableController.updateBundle);

router.post(
  '/:deliverableId/import-task-bundle',
  verifyToken,
  requireAdminOrManagerWithActiveCompany,
  taskBundleController.importBundleToDeliverable
);

router.get('/', verifyToken, requireAdminOrManagerWithActiveCompany, getDeliverables);

module.exports = router;
