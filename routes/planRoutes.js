const express = require('express');
const router = express.Router();
const {
  getPlans,
  getPlan,
  postPlan,
  putPlan,
  removePlan,
} = require('../controllers/planController');

router.get('/', getPlans);
router.get('/:id', getPlan);
router.post('/', postPlan);
router.put('/:id', putPlan);
router.delete('/:id', removePlan);

module.exports = router;
