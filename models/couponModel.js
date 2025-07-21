const db = require('../config/db');

const getCouponByCode = async (code) => {
  const [rows] = await db.query(
    `SELECT * FROM coupons WHERE code = ? AND is_active = true AND valid_till >= CURDATE()`,
    [code]
  );
  return rows[0];
};

const getAllCoupons = async () => {
  const [rows] = await db.query(`SELECT * FROM coupons`);
  return rows;
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
const validateCouponCode = async (code, plan_id) => {
  const [rows] = await db.query(
    `
    SELECT * FROM coupons
    WHERE code = ?
      AND is_active = true
      AND valid_till >= CURDATE()
      AND (plan_id IS NULL OR plan_id = ?)
      AND (times_used < max_uses)
    `,
    [code, plan_id]
  );

  if (rows.length === 0) return { valid: false };

  const coupon = rows[0];

  return {
    valid: true,
    ...coupon,
  };
};

module.exports = {
  getCouponByCode,
  getCouponById,
  getAllCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCouponCode
};
