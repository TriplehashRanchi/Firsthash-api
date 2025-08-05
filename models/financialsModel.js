const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

exports.saveOrUpdateFinancialReport = async (projectId, fileUrl) => {
  // Try to update an existing "report" row with NULL file_url
  const [rows] = await db.query(
    `SELECT id FROM received_payments 
     WHERE project_id = ? AND type = 'report' AND file_url IS NULL 
     ORDER BY created_at DESC LIMIT 1`,
    [projectId]
  );

  if (rows.length > 0) {
    const { id } = rows[0];
    await db.query(
      `UPDATE received_payments SET file_url = ?, description = ? WHERE id = ?`,
      [fileUrl, `Financial Report`, id]
    );
    return { updated: true };
  }

  // Else create a new report row
  const id = uuidv4();

  await db.query(
    `INSERT INTO received_payments (id, project_id, amount, type, description, date_received, created_at, file_url) 
     VALUES (?, ?, 0, 'report', ?, CURDATE(), NOW(), ?)`,
    [id, projectId, `Financial Report`, fileUrl]
  );

  return { created: true };
};

exports.getReceivedAmount = async (projectId) => {
  const [rows] = await db.query(
    `SELECT * FROM received_payments 
     WHERE project_id = ? AND type = 'received'
     ORDER BY date_received ASC`,
    [projectId]
  );
  return { transactions: rows };
};

exports.getPaymentSchedule = async (projectId) => {
  const [rows] = await db.query(
    `SELECT * FROM received_payments 
     WHERE project_id = ? AND type = 'installment'
     ORDER BY date_received ASC`,
    [projectId]
  );
  return {
    paymentInstallments: rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      due_date: row.date_received,
      description: row.description
    }))
  };
};
