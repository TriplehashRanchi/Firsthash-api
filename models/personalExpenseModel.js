const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

async function createPersonalExpense({ company_id, created_by_admin_uid, product_name, rupees, purchase_date, notes }) {
  const id = uuidv4();

  await db.query(
    `INSERT INTO personal_expense
      (id, company_id, created_by_admin_uid, product_name, rupees, purchase_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, company_id, created_by_admin_uid, product_name, rupees, purchase_date, notes || null]
  );

  const [[row]] = await db.query(
    `SELECT
        pe.id,
        pe.company_id,
        c.name AS company_name,
        pe.created_by_admin_uid,
        a.name AS created_by_name,
        pe.product_name,
        pe.rupees,
        pe.purchase_date,
        pe.notes,
        pe.created_at,
        pe.updated_at
     FROM personal_expense pe
     LEFT JOIN companies c ON c.id = pe.company_id
     LEFT JOIN admins a ON a.firebase_uid = pe.created_by_admin_uid
     WHERE pe.id = ?`,
    [id]
  );

  return row;
}

async function getPersonalExpensesByCompany(company_id) {
  const [rows] = await db.query(
    `SELECT
        pe.id,
        pe.company_id,
        c.name AS company_name,
        pe.created_by_admin_uid,
        a.name AS created_by_name,
        pe.product_name,
        pe.rupees,
        pe.purchase_date,
        pe.notes,
        pe.created_at,
        pe.updated_at
     FROM personal_expense pe
     LEFT JOIN companies c ON c.id = pe.company_id
     LEFT JOIN admins a ON a.firebase_uid = pe.created_by_admin_uid
     WHERE pe.company_id = ?
     ORDER BY pe.purchase_date DESC, pe.created_at DESC`,
    [company_id]
  );

  return rows;
}

async function updatePersonalExpense(id, company_id, { product_name, rupees, purchase_date, notes }) {
  const [result] = await db.query(
    `UPDATE personal_expense
     SET product_name = ?, rupees = ?, purchase_date = ?, notes = ?
     WHERE id = ? AND company_id = ?`,
    [product_name, rupees, purchase_date, notes || null, id, company_id]
  );

  if (result.affectedRows === 0) return null;

  const [[row]] = await db.query(
    `SELECT
        pe.id,
        pe.company_id,
        c.name AS company_name,
        pe.created_by_admin_uid,
        a.name AS created_by_name,
        pe.product_name,
        pe.rupees,
        pe.purchase_date,
        pe.notes,
        pe.created_at,
        pe.updated_at
     FROM personal_expense pe
     LEFT JOIN companies c ON c.id = pe.company_id
     LEFT JOIN admins a ON a.firebase_uid = pe.created_by_admin_uid
     WHERE pe.id = ? AND pe.company_id = ?`,
    [id, company_id]
  );

  return row;
}

async function deletePersonalExpense(id, company_id) {
  const [result] = await db.query(
    `DELETE FROM personal_expense
     WHERE id = ? AND company_id = ?`,
    [id, company_id]
  );

  return result.affectedRows > 0;
}

module.exports = {
  createPersonalExpense,
  getPersonalExpensesByCompany,
  updatePersonalExpense,
  deletePersonalExpense,
};
