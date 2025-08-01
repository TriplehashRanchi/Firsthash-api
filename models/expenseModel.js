// File: models/expenseModel.js
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

exports.createExpense = async (expenseData) => {
    const { company_id, project_id, description, category, amount, expense_date } = expenseData;
    const expenseId = uuidv4();
    
    await db.query(
        `INSERT INTO expenses (id, company_id, project_id, description, category, amount, expense_date) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [expenseId, company_id, project_id, description, category, amount, expense_date]
    );
    const [[newExpense]] = await db.query('SELECT * FROM expenses WHERE id = ?', [expenseId]);
    return newExpense;
};

exports.updateExpense = async (expenseId, company_id, updateData) => {
    const { description, category, amount, expense_date } = updateData;
    const [result] = await db.query(
        `UPDATE expenses SET description = ?, category = ?, amount = ?, expense_date = ? 
         WHERE id = ? AND company_id = ?`,
        [description, category, amount, expense_date, expenseId, company_id]
    );
    return result.affectedRows > 0;
};

exports.deleteExpense = async (expenseId, company_id) => {
    const [result] = await db.query('DELETE FROM expenses WHERE id = ? AND company_id = ?', [expenseId, company_id]);
    return result.affectedRows > 0;
};