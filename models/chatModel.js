const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// 💬 Fetch all messages for a project
exports.getProjectMessages = async (company_id, project_id) => {
  const [rows] = await db.query(
    `
    SELECT 
      m.id,
      m.sender_uid,
      m.message,
      m.created_at,
      COALESCE(a.name, e.name) AS sender_name
    FROM project_messages m
    LEFT JOIN admins a ON a.firebase_uid = m.sender_uid
    LEFT JOIN employees e ON e.firebase_uid = m.sender_uid
    WHERE m.company_id = ? AND m.project_id = ?
    ORDER BY m.created_at ASC
    `,
    [company_id, project_id]
  );
  return rows;
};

// 💬 Add new message
exports.insertMessage = async (company_id, project_id, sender_uid, message) => {
  const id = uuidv4();
  await db.query(
    `INSERT INTO project_messages (id, company_id, project_id, sender_uid, message)
     VALUES (?, ?, ?, ?, ?)`,
    [id, company_id, project_id, sender_uid, message]
  );
  return { id, project_id, sender_uid, message };
};
