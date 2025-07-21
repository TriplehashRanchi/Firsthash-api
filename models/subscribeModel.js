const db = require('../config/db');

const updateCompanyAfterPayment = async ({ firebase_uid, plan, expiry, payment_id }) => {
  await db.query(
    `UPDATE companies SET plan = ?, plan_expiry = ?, razorpay_subscription_id = ? WHERE owner_admin_uid = ?`,
    [plan, expiry, payment_id, firebase_uid]
  );
};

const activateAdmin = async (firebase_uid) => {
  await db.query(
    `UPDATE admins SET status = 'active' WHERE firebase_uid = ?`,
    [firebase_uid]
  );
};

module.exports = { updateCompanyAfterPayment, activateAdmin };
