const express = require('express');
const router = express.Router();

const { getCalculatedExpenseOverview } = require('../controllers/calculatedExpenseController');
const { verifyToken, requireAdminWithActiveCompany } = require('../middleware/auth');

router.use(verifyToken, requireAdminWithActiveCompany);

router.get('/overview', getCalculatedExpenseOverview);

module.exports = router;
