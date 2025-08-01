// File: controllers/expenseController.js
const expenseModel = require('../models/expenseModel');

exports.createExpense = async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const { projectId } = req.params;
        const { productName, category, expense, date } = req.body; // Assuming date is passed for expense_date

        if (!productName || !category || !expense || !date) {
            return res.status(400).json({ error: 'All expense fields are required.' });
        }
        const newExpense = await expenseModel.createExpense({ 
            company_id, project_id: projectId, description: productName, category, 
            amount: expense, expense_date: date 
        });
        res.status(201).json(newExpense);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
};
exports.updateExpense = async (req, res) => { 
    try {
        const expenseId = req.params.id;
        const company_id = req.user.company_id;
        const { productName, category, expense, date } = req.body; // Assuming date is passed for expense_date
        const updated = await expenseModel.updateExpense(expenseId, company_id, { 
            description: productName, category, amount: expense, expense_date: date 
        });
        if (!updated) {
            return res.status(404).json({ error: 'Expense not found for update.' });
        }
        res.json(updated);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
 };
exports.deleteExpense = async (req, res) => { 
    try {
        const expenseId = req.params.id;
        const company_id = req.user.company_id;
        const deleted = await expenseModel.deleteExpense(expenseId, company_id);
        if (!deleted) {
            return res.status(404).json({ error: 'Expense not found for deletion.' });
        }
        res.json({ message: 'Expense deleted successfully.' });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
 };