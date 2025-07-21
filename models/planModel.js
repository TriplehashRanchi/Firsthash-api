const db = require('../config/db');

const getAllPlans = async () => {
  const [rows] = await db.query(`SELECT * FROM plans WHERE is_active = true`);
  return rows;
};

const getPlanById = async (id) => {
  const [rows] = await db.query(`SELECT * FROM plans WHERE id = ?`, [id]);
  return rows[0];
};

const createPlan = async ({ name, price, duration_days }) => {
  const [result] = await db.query(
    `INSERT INTO plans (name, price, duration_days) VALUES (?, ?, ?)`,
    [name, price, duration_days]
  );
  return result;
};

const updatePlan = async (id, data) => {
  const { name, price, duration_days } = data;
  const [result] = await db.query(
    `UPDATE plans SET name = ?, price = ?, duration_days = ? WHERE id = ?`,
    [name, price, duration_days, id]
  );
  return result;
};

const deletePlan = async (id) => {
  const [result] = await db.query(`UPDATE plans SET is_active = false WHERE id = ?`, [id]);
  return result;
};

module.exports = {
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
};
