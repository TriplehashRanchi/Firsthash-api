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

exports.getAllExpensesByCompany = async (company_id) => {
    const [rows] = await db.query(
        `SELECT * FROM expenses WHERE company_id = ? ORDER BY expense_date DESC`,
        [company_id]
    );
    return rows;
};

exports.getAllExpensesWithProjectInfo = async (company_id) => {
    const [rows] = await db.query(
        `SELECT 
            e.id,
            e.description,
            e.category,
            e.amount,
            e.expense_date,
            e.project_id,
            p.name AS projectName 
         FROM expenses AS e
         JOIN projects AS p ON e.project_id = p.id
         WHERE e.company_id = ?
         ORDER BY e.expense_date DESC`,
        [company_id]
    );
    return rows;
};
