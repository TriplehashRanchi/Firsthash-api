const db = require('../config/db');

const getAdminByUID = async (firebase_uid) => {
  try {
  const [rows] = await db.query(
    `SELECT * FROM admins WHERE firebase_uid = ?`,
    [firebase_uid]
  );
  return rows[0];
} catch (error) {
  console.log('getAdminByUID',error);
  return null;
}
  
};

const getEmployeeByUID = async (firebase_uid) => {
  try{
  const [rows] = await db.query(
    `SELECT * FROM employees WHERE firebase_uid = ?`,
    [firebase_uid]
  );
  return rows[0];
} catch (error) {
  console.log('getEmployeeByUID',error);
  return null;
}
};

module.exports = { getAdminByUID, getEmployeeByUID };
