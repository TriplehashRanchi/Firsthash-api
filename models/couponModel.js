const db = require('../config/db');

const getCouponByCode = async (code) => {
  const [rows] = await db.query(
    `SELECT * FROM coupons WHERE code = ? AND is_active = true AND valid_till >= CURDATE()`,
    [code]
  );
  return rows[0];
};

const getCouponById = async (id) => {
  const [rows] = await db.query(`SELECT * FROM coupons WHERE id = ?`, [id]);
  return rows[0];
};

const createCoupon = async (data) => {
  const {
    code, discount_type, discount_value, valid_till, max_uses, plan_id
  } = data;

  const [result] = await db.query(
    `INSERT INTO coupons (code, discount_type, discount_value, valid_till, max_uses, plan_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [code, discount_type, discount_value, valid_till, max_uses, plan_id]
  );
  return result;
};

const updateCoupon = async (id, data) => {
  const {
    code, discount_type, discount_value, valid_till, max_uses, plan_id, is_active
  } = data;

  const [result] = await db.query(
    `UPDATE coupons
     SET code = ?, discount_type = ?, discount_value = ?, valid_till = ?, max_uses = ?, plan_id = ?, is_active = ?
     WHERE id = ?`,
    [code, discount_type, discount_value, valid_till, max_uses, plan_id, is_active, id]
  );
  return result;
};

const deleteCoupon = async (id) => {
  const [result] = await db.query(`UPDATE coupons SET is_active = false WHERE id = ?`, [id]);
  return result;
};

module.exports = {
  getCouponByCode,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
};
