/*
File: backend/routes/roleRoutes.js
Description: Router for role endpoints
*/

const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');

router.get('/', roleController.listRoles);
router.get('/:id', roleController.getRole);
router.post('/', roleController.createRole);
router.put('/:id', roleController.updateRole);
router.delete('/:id', roleController.deleteRole);

module.exports = router;

