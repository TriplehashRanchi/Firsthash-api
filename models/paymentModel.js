// File: models/paymentModel.js

const db = require('../config/db');

/**
 * Adds a new received payment record to the database for a specific project.
 * @param {object} paymentData - Contains projectId, amount, date, and description.
 * @returns {Promise<object>} The newly created payment object.
 */
exports.addPayment = async (paymentData) => {
    const { projectId, amount, date, description } = paymentData;

    const [result] = await db.query(
        'INSERT INTO received_payments (project_id, amount, date_received, description) VALUES (?, ?, ?, ?)',
        [projectId, amount, date, description]
    );

    // Fetch and return the newly created record to ensure consistency
    const [[newPayment]] = await db.query('SELECT * FROM received_payments WHERE id = ?', [result.insertId]);
    return newPayment;
};