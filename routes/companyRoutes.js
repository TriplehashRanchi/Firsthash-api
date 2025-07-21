const express = require('express');
const router = express.Router();
const { getCompanyByUid } = require('../controllers/companyController');

router.get('/by-uid/:firebase_uid', getCompanyByUid);

module.exports = router;
