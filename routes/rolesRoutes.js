const express = require('express');
const router  = express.Router();
const { verifyToken, requireAdminWithActiveCompany } = require('../middleware/auth');
const ctrl    = require('../controllers/roleController');

router.use(verifyToken, requireAdminWithActiveCompany);

// Definition routes (unchanged)
router.get('/',        ctrl.listRoles);
router.get('/:id',     ctrl.getRole);
router.post('/',       ctrl.createRole);
router.put('/:id',     ctrl.updateRole);
router.delete('/:id',  ctrl.deleteRole);

// Assignment routes (must come **before** /:id)
router.get('/user/:firebase_uid', ctrl.listUserRoles);
router.post('/assign',            ctrl.assignRoles);
router.delete('/assign',          ctrl.unassignRoles);

module.exports = router;
