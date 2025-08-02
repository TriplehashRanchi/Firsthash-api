// controllers/adminController.js
const { getAdminByUID, updateAdminByUID } = require("../models/adminModel");

/**
 * Controller to get the profile of the currently logged-in admin.
 */
const getAdminProfile = async (req, res) => {
    try {
        // Your `verifyToken` middleware correctly attaches the user's UID to `req.firebase_uid`.
        // We use this as the secure source of truth.
        const authenticated_uid = req.firebase_uid; 
        
        const admin = await getAdminByUID(authenticated_uid);

        if (!admin) {
            return res.status(404).json({ error: 'Admin profile not found.' });
        }
        res.status(200).json(admin);
    } catch (err) {
        console.error("Error fetching admin profile:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Controller to update the profile of the currently logged-in admin.
 */
const updateAdminProfile = async (req, res) => {
    try {
        const authenticated_uid = req.firebase_uid;
        const incomingData = req.body;

        // Create a "whitelist" of fields the user IS allowed to change.
        // A user should never change their own email, company_id, or status from a simple profile form.
        const allowedFields = ['name', 'phone', 'photo'];

        const sanitizedData = {};
        Object.keys(incomingData).forEach(key => {
            if (allowedFields.includes(key)) {
                // Convert empty strings to null to prevent database type errors.
                sanitizedData[key] = incomingData[key] === '' ? null : incomingData[key];
            }
        });

        // Ensure there is actually something to update.
        if (Object.keys(sanitizedData).length === 0) {
            return res.status(400).json({ error: "No valid fields provided for update." });
        }
        
        const result = await updateAdminByUID(authenticated_uid, sanitizedData);

        if (result.affectedRows === 0) {
             return res.status(404).json({ error: 'Admin profile not found, so no update was made.' });
        }

        // After updating, fetch the complete, fresh profile and send it back to the frontend.
        const updatedAdmin = await getAdminByUID(authenticated_uid);
        res.status(200).json(updatedAdmin);
    } catch (err) {
        console.error("Error updating admin profile:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getAdminProfile,
    updateAdminProfile,
};
