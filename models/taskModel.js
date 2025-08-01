// File: models/taskModel.js
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// Create Task (Now accepts more fields)
exports.createTask = async (taskData) => {
    const { company_id, title, description, due_date, priority, project_id, deliverable_id, parent_task_id } = taskData;
    const taskId = uuidv4();

    await db.query(
        `INSERT INTO tasks (id, company_id, title, description, due_date, priority, project_id, deliverable_id, parent_task_id, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'to_do')`,
        [taskId, company_id, title, description, due_date, priority || 'medium', project_id, deliverable_id, parent_task_id]
    );
    const [[newTask]] = await db.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    return newTask;
};

// Update Task (For title, status, due date, etc.)
exports.updateTask = async (taskId, company_id, updateData) => {
    // We will build a dynamic query to only update the fields that are provided
    const fields = ['title', 'description', 'status', 'priority', 'due_date','voice_note_url'];
    const valuePlaceholders = [];
    const values = [];

    for (const field of fields) {
        if (updateData[field] !== undefined) {
            valuePlaceholders.push(`${field} = ?`);
            values.push(updateData[field]);
        }
    }

    if (values.length === 0) return null; // Nothing to update

    values.push(taskId, company_id);
    const sql = `UPDATE tasks SET ${valuePlaceholders.join(', ')} WHERE id = ? AND company_id = ?`;
    
    await db.query(sql, values);
    const [[updatedTask]] = await db.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    return updatedTask;
};

// Manage Task Assignees (One function to rule them all)
exports.updateTaskAssignees = async (taskId, company_id, assigneeIds = []) => {
    const connection = await db.getConnection();
    await connection.beginTransaction();
    try {
        // First, verify the task belongs to the company
        const [[task]] = await connection.query('SELECT id FROM tasks WHERE id = ? AND company_id = ?', [taskId, company_id]);
        if (!task) throw new Error('Task not found or permission denied.');

        // Delete all existing assignments for this task
        await connection.query('DELETE FROM task_assignees WHERE task_id = ?', [taskId]);

        // If new assignees are provided, insert them
        if (assigneeIds.length > 0) {
            const assigneeValues = assigneeIds.map(uid => [taskId, uid]);
            await connection.query('INSERT INTO task_assignees (task_id, employee_firebase_uid) VALUES ?', [assigneeValues]);
        }
        
        await connection.commit();
        return { success: true };
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
};

// Delete Task
exports.deleteTask = async (taskId, company_id) => {
    const [result] = await db.query('DELETE FROM tasks WHERE id = ? AND company_id = ?', [taskId, company_id]);
    return result.affectedRows > 0;
};