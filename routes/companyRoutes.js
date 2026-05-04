const express = require('express');
const router = express.Router();
const { 
    getCompanyByUid, // This can be used for public viewing of profiles
    updateCompany,
    deleteCompany,
     getCompanyByIdController, 
     getCompanyForEmployee
} = require('../controllers/companyController');
const {
    getActiveLocation,
    saveActiveLocation,
} = require('../controllers/companyLocationController');

// IMPORTANT: Import your authentication middleware here.
// I am assuming it's named 'verifyToken' from previous context.
const { verifyToken, requireAdminWithActiveCompany } = require('../middleware/auth'); 


router.get('/for-employee/:firebase_uid', verifyToken , getCompanyForEmployee);


// --- Public Route (Does not need authentication) ---
// Anyone can view a company profile if they have the UID.
router.get('/by-uid/:firebase_uid', getCompanyByUid);

router.get('/by-id/:company_id', getCompanyByIdController);


// --- Protected Routes (Requires a valid token) ---
// These routes for updating and deleting a profile now first go through the `verifyToken` middleware.

// To update, a user must be logged in. The controller will use the token's UID.
router.put('/by-uid/:firebase_uid', verifyToken, updateCompany);

router.get('/location/active', verifyToken, requireAdminWithActiveCompany, getActiveLocation);
router.put('/location/active', verifyToken, requireAdminWithActiveCompany, saveActiveLocation);

// To delete, a user must be logged in. The controller will use the token's UID.
router.delete('/by-uid/:firebase_uid', verifyToken, deleteCompany);


module.exports = router;
