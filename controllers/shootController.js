// File: controllers/shootController.js

const shootModel = require('../models/shootModel');

/**
 * Handles the API request to update assignments for a service within a shoot.
 */
exports.updateAssignments = async (req, res) => {
    try {
        const { shootId } = req.params; // Get the shoot ID from the URL
        const { serviceName, assigneeIds } = req.body; // Get data from the request body
        const company_id = req.company.id; // Get company ID from auth middleware

        // Basic validation
        if (!serviceName || !Array.isArray(assigneeIds)) {
            return res.status(400).json({ error: 'A serviceName and an array of assigneeIds are required.' });
        }

        // Call the model to perform the database update
        await shootModel.updateShootAssignments(shootId, serviceName, assigneeIds, company_id);

        // Send a success response
        res.json({ success: true, message: 'Assignments updated successfully.' });

    } catch (err) {
        console.error('❌ Failed to update shoot assignments:', err);
        // Handle specific "not found" errors from the model
        if (err.message.includes('Shoot not found')) {
            return res.status(404).json({ error: err.message });
        }
        // Handle all other errors
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
};