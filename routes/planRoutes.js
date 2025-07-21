const express = require('express');
const router = express.Router();

const {
  getPlans,
  getPlan,
  postPlan,
  putPlan,
  removePlan,
} = require('../controllers/planController');

const verifySuperAdminJWT = require('../middleware/verifySuperAdminJWT');

// ❌ Public Routes
router.get('/', getPlans);        // Admins can access this on /subscribe
router.get('/:id', getPlan);      // Optional: allow public if needed

// ✅ Protected Routes
router.post('/', verifySuperAdminJWT, postPlan);
router.put('/:id', verifySuperAdminJWT, putPlan);
router.delete('/:id', verifySuperAdminJWT, removePlan);

module.exports = router;
