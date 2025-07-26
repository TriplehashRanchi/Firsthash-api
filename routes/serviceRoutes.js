// File: routes/serviceRoutes.js
const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, serviceController.getServices);
router.post('/', verifyToken, serviceController.addService);
router.delete('/:id', verifyToken, serviceController.deleteService);

module.exports = router;