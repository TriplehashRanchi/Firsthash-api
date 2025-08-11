// File: controllers/taskController.js

const taskModel = require('../models/taskModel');


exports.getTasks = async (req, res) => {
    try {
        // The company ID is attached by your `requireAdminWithActiveCompany` middleware
        const company_id = req.company.id;
        
        // We will assume a function exists in your model called 'getTasksByCompany'
        // This function would fetch all tasks and could join with other tables
        // to get details like assignee names, project titles, etc.
        const tasks = await taskModel.getTasksByCompany(company_id);
        
        res.json(tasks);

    } catch (err) {
        console.error('❌ Failed to get tasks:', err);
        res.status(500).json({ error: 'Server error while fetching tasks.' });
    }
};

/**
 * @desc    Create a new task
 * @route   POST /api/tasks
 * @access  Private
 */
exports.createTask = async (req, res) => {
    try {
        // Get company_id from the authenticated user (provided by 'protect' middleware)
        const company_id = req.company.id;
        // Combine request body with the company_id for the model
        const taskData = { ...req.body, company_id };

        // Basic validation: A task must have a title
        if (!taskData.title || taskData.title.trim() === '') {
            return res.status(400).json({ error: 'Task title is required.' });
        }

        // Call the model function to create the task in the database
        const newTask = await taskModel.createTask(taskData);

        // Send the newly created task object back to the frontend with a 201 Created status
        res.status(201).json(newTask);

    } catch (err) {
        console.error('❌ Failed to create task:', err);
        res.status(500).json({ error: 'Server error while creating task.' });
    }
};

/**
 * @desc    Update an existing task's details (title, status, etc.)
 * @route   PUT /api/tasks/:id
 * @access  Private
 */
exports.updateTask = async (req, res) => {
    try {
        const company_id = req.company.id;
        const taskId = req.params.id; // Get the task ID from the URL
        const updateData = req.body; // Get the fields to update from the body

        // Prevent updating key fields like company_id or project_id directly
        delete updateData.id;
        delete updateData.company_id;
        delete updateData.project_id;
        delete updateData.deliverable_id;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No update data provided.' });
        }

        // Call the model to perform the update
        const updatedTask = await taskModel.updateTask(taskId, company_id, updateData);

        if (updatedTask) {
            // If the model returns the updated task, send it back
            res.json(updatedTask);
        } else {
            // If the model returns null, the task was not found for that company
            res.status(404).json({ error: 'Task not found or permission denied.' });
        }

    } catch (err) {
        console.error('❌ Failed to update task:', err);
        res.status(500).json({ error: 'Server error while updating task.' });
    }
};

/**
 * @desc    Delete a task
 * @route   DELETE /api/tasks/:id
 * @access  Private
 */
exports.deleteTask = async (req, res) => {
    try {
        const company_id = req.company.id;
        const taskId = req.params.id;

        const wasDeleted = await taskModel.deleteTask(taskId, company_id);

        if (wasDeleted) {
            // A successful DELETE request should return a 204 No Content status
            // It's standard practice not to send any JSON body back.
            res.status(204).send();
        } else {
            // If nothing was deleted, the task was not found
            res.status(404).json({ error: 'Task not found or permission denied.' });
        }

    } catch (err) {
        console.error('❌ Failed to delete task:', err);
        res.status(500).json({ error: 'Server error while deleting task.' });
    }
};

/**
 * @desc    Update the assignees for a task
 * @route   PUT /api/tasks/:id/assignees
 * @access  Private
 */
exports.updateTaskAssignees = async (req, res) => {
    try {
        const company_id = req.company.id;
        const taskId = req.params.id;
        const { assigneeIds } = req.body; // Expecting an array: { "assigneeIds": ["uid1", "uid2"] }

        // Validate that we received a proper array
        if (!Array.isArray(assigneeIds)) {
            return res.status(400).json({ error: 'assigneeIds must be an array.' });
        }

        const result = await taskModel.updateTaskAssignees(taskId, company_id, assigneeIds);
        
        res.json(result);

    } catch (err) {
        // The model might throw an error if the task is not found
        if (err.message.includes('Task not found')) {
            return res.status(404).json({ error: err.message });
        }
        console.error('❌ Failed to update task assignees:', err);
        res.status(500).json({ error: 'Server error while updating assignees.' });
    }
};