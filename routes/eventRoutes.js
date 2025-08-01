// File: routes/eventRoutes.js
const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, eventController.getEventTitles);
router.post('/', verifyToken, eventController.addEventTitle);
router.delete('/:id', verifyToken, eventController.deleteEventTitle);

module.exports = router;