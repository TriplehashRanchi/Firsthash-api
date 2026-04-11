const express = require('express');
const router = express.Router();

const {
  getPersonalExpenses,
  createPersonalExpense,
  updatePersonalExpense,
  deletePersonalExpense,
} = require('../controllers/personalExpenseController');
const { verifyToken, requireAdminWithActiveCompany } = require('../middleware/auth');

router.use(verifyToken, requireAdminWithActiveCompany);

router.route('/')
  .get(getPersonalExpenses)
  .post(createPersonalExpense);

router.route('/:id')
  .put(updatePersonalExpense)
  .delete(deletePersonalExpense);

module.exports = router;
