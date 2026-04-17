const express = require('express');
const router = express.Router();

const {
  getExpenseMeta,
  getExpenseSummary,
  getPersonalExpenses,
  getPersonalExpenseById,
  createPersonalExpense,
  updatePersonalExpense,
  deletePersonalExpense,
  getExpenseCategories,
  createExpenseCategory,
  getParties,
  createParty,
  getStates,
} = require('../controllers/personalExpenseController');
const { verifyToken, requireAdminWithActiveCompany } = require('../middleware/auth');

router.use(verifyToken, requireAdminWithActiveCompany);

router.get('/meta', getExpenseMeta);
router.get('/summary', getExpenseSummary);

router.route('/categories')
  .get(getExpenseCategories)
  .post(createExpenseCategory);

router.route('/parties')
  .get(getParties)
  .post(createParty);

router.get('/states', getStates);

router.route('/')
  .get(getPersonalExpenses)
  .post(createPersonalExpense);

router.route('/:id')
  .get(getPersonalExpenseById)
  .put(updatePersonalExpense)
  .delete(deletePersonalExpense);

module.exports = router;
