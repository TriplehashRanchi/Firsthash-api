const express = require('express');
const router = express.Router();

const taskBundleController = require('../controllers/taskBundleController');
const { verifyToken, requireAdminOrManagerWithActiveCompany } = require('../middleware/auth');

router.get('/', verifyToken, requireAdminOrManagerWithActiveCompany, taskBundleController.getBundles);
router.post('/', verifyToken, requireAdminOrManagerWithActiveCompany, taskBundleController.createBundle);
router.put('/:id', verifyToken, requireAdminOrManagerWithActiveCompany, taskBundleController.updateBundle);
router.delete('/:id', verifyToken, requireAdminOrManagerWithActiveCompany, taskBundleController.deleteBundle);

router.get('/:id/items', verifyToken, requireAdminOrManagerWithActiveCompany, taskBundleController.getBundleItems);
router.post('/:id/items', verifyToken, requireAdminOrManagerWithActiveCompany, taskBundleController.addBundleItem);
router.put('/:id/items/:itemId', verifyToken, requireAdminOrManagerWithActiveCompany, taskBundleController.updateBundleItem);
router.delete('/:id/items/:itemId', verifyToken, requireAdminOrManagerWithActiveCompany, taskBundleController.deleteBundleItem);

module.exports = router;
