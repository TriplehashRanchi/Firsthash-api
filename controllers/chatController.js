const chatModel = require("../models/chatModel");
const db = require("../config/db");

// Fetch list of projects for user
exports.getProjects = async (req, res) => {
  try {
    const role = req.role || req.user?.role;
    const firebase_uid = req.firebase_uid || req.user?.firebase_uid;
    const company_id = req.company?.id;

    if (!firebase_uid || !company_id) {
      return res.status(400).json({ error: "Missing user or company info." });
    }

    let query, params;

    // 🧩 ADMIN: See all company projects
    if (role === "admin") {
      query = `
        SELECT id, name, status 
        FROM projects 
        WHERE company_id = ?
        ORDER BY id DESC`;
      params = [company_id];
    }
    // 🧩 MANAGER: See projects where this manager is assigned or oversees tasks
    else if (role === "manager") {
      query = `
        SELECT DISTINCT p.id, p.name, p.status
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
        LEFT JOIN task_assignees ta ON ta.task_id = t.id
        LEFT JOIN employees e ON e.firebase_uid = ta.employee_firebase_uid
        WHERE p.company_id = ?
          AND (e.firebase_uid = ? OR t.manager_firebase_uid = ?)
        ORDER BY p.id DESC`;
      params = [company_id, firebase_uid, firebase_uid];
    }
    // 🧩 EMPLOYEE: See only projects where they are assigned
    else {
      query = `
        SELECT DISTINCT p.id, p.name, p.status
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
        LEFT JOIN task_assignees ta ON ta.task_id = t.id
        WHERE p.company_id = ?
          AND ta.employee_firebase_uid = ?
        ORDER BY p.id DESC`;
      params = [company_id, firebase_uid];
    }

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("❌ getProjects error:", err.message);
    res.status(500).json({ error: "Failed to fetch projects." });
  }
};

// Fetch messages for project
exports.getMessages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const company_id = req.company?.id;
    const messages = await chatModel.getProjectMessages(company_id, projectId);
    res.json(messages);
  } catch (err) {
    console.error("❌ getMessages error:", err.message);
    res.status(500).json({ error: "Failed to fetch messages." });
  }
};

// Send new message
exports.sendMessage = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { message } = req.body;
    const company_id = req.company.id;
    const sender_uid = req.user.firebase_uid;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Message cannot be empty." });
    }

    // Insert message
    const newMsg = await chatModel.insertMessage(
      company_id,
      projectId,
      sender_uid,
      message
    );

    // Fetch sender name (admin or employee)
    const [[sender]] = await db.query(
      `
      SELECT name FROM admins WHERE firebase_uid = ?
      UNION
      SELECT name FROM employees WHERE firebase_uid = ?
      LIMIT 1
      `,
      [sender_uid, sender_uid]
    );

    // Include sender name in response
    res.status(201).json({
      ...newMsg,
      sender_name: sender ? sender.name : "Unknown",
      created_at: new Date(),
    });
  } catch (err) {
    console.error("sendMessage error:", err);
    res.status(500).json({ error: "Failed to send message." });
  }
};