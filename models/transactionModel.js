const db = require('../config/db');

// Log a new transaction (on order creation)
const logTransaction = async ({
  txn_id,
  gateway_txn_id = null,
  admin_id,
  amount,
  description = '',
  status = 'pending',
}) => {
  const [rows] = await db.query(
    `INSERT INTO transactions (txn_id, gateway_txn_id, admin_id, amount, description, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [txn_id, gateway_txn_id, admin_id, amount, description, status]
  );
  return rows;
};

// Update transaction after payment success/failure
const updateTransactionStatus = async (txn_id, status, gateway_txn_id = null) => {
  const [rows] = await db.query(
    `UPDATE transactions
     SET status = ?, gateway_txn_id = ?
     WHERE txn_id = ?`,
    [status, gateway_txn_id, txn_id]
  );
  return rows;
};

module.exports = {
  logTransaction,
  updateTransactionStatus,
};
