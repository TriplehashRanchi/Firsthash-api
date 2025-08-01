const express = require('express');
const router = express.Router();
const { 
    getCompanyByUid, 
    updateCompany, // Import the new controller
    deleteCompany
} = require('../controllers/companyController');

// Route to get a company's profile
router.get('/by-uid/:firebase_uid', getCompanyByUid);

// NEW ROUTE: Route to update a company's profile
// It uses the same URL but responds to the PUT HTTP method.
router.put('/by-uid/:firebase_uid', updateCompany);

// NEW ROUTE: Route to delete a company's profile
router.delete('/by-uid/:firebase_uid', deleteCompany);


module.exports = router;