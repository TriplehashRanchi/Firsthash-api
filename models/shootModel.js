// File: models/shootModel.js

const db = require('../config/db');

/**
 * Updates the list of assigned employees for a specific service within a shoot.
 * It uses a transaction to ensure data integrity.
 * @param {number} shootId - The ID of the shoot.
 * @param {string} serviceName - The name of the service (e.g., "Candid Photography").
 * @param {string[]} assigneeIds - An array of employee firebase_uids.
 * @param {string} companyId - The company ID for security.
 * @returns {Promise<{success: boolean}>}
 */
exports.updateShootAssignments = async (shootId, serviceName, assigneeIds, companyId) => {
    // A transaction ensures that both the DELETE and INSERT operations succeed or fail together.
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        // Step 1: Security Verification.
        // Before making changes, confirm the shoot exists and belongs to the correct company.
        const [[shoot]] = await connection.query(
            'SELECT s.id FROM shoots s JOIN projects p ON s.project_id = p.id WHERE s.id = ? AND p.company_id = ?',
            [shootId, companyId]
        );

        if (!shoot) {
            throw new Error('Shoot not found or permission denied.');
        }

        // Step 2: Clear all existing assignments for this specific service on this shoot.
        await connection.query(
            'DELETE FROM shoot_assignments WHERE shoot_id = ? AND service_name = ?',
            [shootId, serviceName]
        );

        // Step 3: Insert the new list of assignees, if any are provided.
        if (assigneeIds && assigneeIds.length > 0) {
            const assigneeValues = assigneeIds.map(uid => [shootId, serviceName, uid]);
            await connection.query(
                'INSERT INTO shoot_assignments (shoot_id, service_name, employee_firebase_uid) VALUES ?',
                [assigneeValues]
            );
        }
        
        // If everything succeeded, commit the changes to the database.
        await connection.commit();
        return { success: true };

    } catch (err) {
        // If any error occurred, roll back all changes.
        await connection.rollback();
        // Re-throw the error to be handled by the controller.
        throw err;
    } finally {
        // Always release the connection back to the pool.
        connection.release();
    }
};