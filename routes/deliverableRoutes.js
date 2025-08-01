const express = require('express');
const router = express.Router();

const deliverableController = require('../controllers/deliverableController');

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

module.exports = router;
