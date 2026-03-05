// File: models/shootModel.js

const db = require('../config/db');

const toMySqlDateTime = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        const localMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/);
        if (localMatch) {
            return `${localMatch[1]} ${localMatch[2]}${localMatch[3] || ':00'}`;
        }
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;

    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    const hh = String(parsed.getHours()).padStart(2, '0');
    const mi = String(parsed.getMinutes()).padStart(2, '0');
    const ss = String(parsed.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
};

const buildDefaultSlotWindowFromShoot = (shoot) => {
    if (!shoot?.date) return { start: null, end: null };

    const datePart = shoot.date instanceof Date
        ? `${shoot.date.getFullYear()}-${String(shoot.date.getMonth() + 1).padStart(2, '0')}-${String(shoot.date.getDate()).padStart(2, '0')}`
        : String(shoot.date).slice(0, 10);

    const timePart = shoot.time ? String(shoot.time).slice(0, 8) : '09:00:00';
    const start = toMySqlDateTime(`${datePart} ${timePart}`);
    if (!start) return { start: null, end: null };

    const startDate = new Date(start.replace(' ', 'T'));
    if (Number.isNaN(startDate.getTime())) return { start: null, end: null };

    const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));
    const end = toMySqlDateTime(endDate);
    return { start, end };
};

/**
 * Updates the list of assigned employees for a specific service within a shoot.
 * It uses a transaction to ensure data integrity.
 * @param {number} shootId - The ID of the shoot.
 * @param {string} serviceName - The name of the service (e.g., "Candid Photography").
 * @param {string[]} assigneeIds - An array of employee firebase_uids.
 * @param {string} companyId - The company ID for security.
 * @returns {Promise<{success: boolean}>}
 */
exports.updateShootAssignments = async (shootId, serviceName, assigneeIds, companyId, startAt, endAt) => {
    // A transaction ensures that both the DELETE and INSERT operations succeed or fail together.
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        // Step 1: Security Verification.
        // Before making changes, confirm the shoot exists and belongs to the correct company.
        const [[shoot]] = await connection.query(
            `SELECT s.id, s.title, s.date, s.time
             FROM shoots s
             JOIN projects p ON s.project_id = p.id
             WHERE s.id = ? AND p.company_id = ?`,
            [shootId, companyId]
        );

        if (!shoot) {
            throw new Error('Shoot not found or permission denied.');
        }

        const [[serviceRow]] = await connection.query(
            `SELECT 1
             FROM shoot_services ss
             JOIN services ser ON ser.id = ss.service_id
             WHERE ss.shoot_id = ? AND ser.name = ?
             LIMIT 1`,
            [shootId, serviceName]
        );
        if (!serviceRow) {
            throw new Error('Selected service is not valid for this shoot.');
        }

        const uniqueAssigneeIds = Array.isArray(assigneeIds)
            ? [...new Set(assigneeIds.filter(Boolean).map((v) => String(v).trim()).filter(Boolean))]
            : [];

        const normalizedStartAt = toMySqlDateTime(startAt);
        const normalizedEndAt = toMySqlDateTime(endAt);
        const defaultSlot = buildDefaultSlotWindowFromShoot(shoot);
        const effectiveStartAt = normalizedStartAt || defaultSlot.start;
        const effectiveEndAt = normalizedEndAt || defaultSlot.end;

        if (uniqueAssigneeIds.length > 0) {
            if (!effectiveStartAt || !effectiveEndAt) {
                const err = new Error('Start and end time are required for assignments.');
                err.statusCode = 400;
                throw err;
            }
            if (new Date(effectiveEndAt) <= new Date(effectiveStartAt)) {
                const err = new Error('End time must be greater than start time.');
                err.statusCode = 400;
                throw err;
            }
        }

        // Step 2: Clear all existing assignments for this specific service on this shoot.
        await connection.query(
            'DELETE FROM shoot_assignments WHERE shoot_id = ? AND service_name = ?',
            [shootId, serviceName]
        );

        await connection.query(
            `UPDATE team_assignment_slots
             SET status = 'released', released_at = NOW(), updated_at = NOW()
             WHERE company_id = ? AND shoot_id = ? AND service_name = ? AND status = 'booked'`,
            [companyId, shootId, serviceName]
        );

        // Step 3: Insert the new list of assignees, if any are provided.
        if (uniqueAssigneeIds.length > 0) {
            const [memberRows] = await connection.query(
                `SELECT firebase_uid, name
                 FROM employees
                 WHERE company_id = ? AND firebase_uid IN (?) AND status = 'active'
                 FOR UPDATE`,
                [companyId, uniqueAssigneeIds]
            );

            if (memberRows.length !== uniqueAssigneeIds.length) {
                const found = new Set(memberRows.map((r) => r.firebase_uid));
                const missing = uniqueAssigneeIds.filter((uid) => !found.has(uid));
                const err = new Error(`Invalid or inactive members selected: ${missing.join(', ')}`);
                err.statusCode = 400;
                throw err;
            }

            const [conflictRows] = await connection.query(
                `SELECT
                    tas.member_uid,
                    e.name AS member_name,
                    tas.start_at,
                    tas.end_at,
                    tas.shoot_id,
                    tas.service_name,
                    s.title AS shoot_title,
                    s.date AS shoot_date,
                    s.time AS shoot_time
                 FROM team_assignment_slots tas
                 JOIN employees e ON e.firebase_uid = tas.member_uid
                 JOIN shoots s ON s.id = tas.shoot_id
                 JOIN projects p ON p.id = s.project_id
                 WHERE tas.company_id = ?
                   AND p.company_id = ?
                   AND tas.member_uid IN (?)
                   AND tas.status = 'booked'
                   AND tas.start_at < ?
                   AND tas.end_at > ?
                   AND NOT (tas.shoot_id = ? AND tas.service_name = ?)`,
                [companyId, companyId, uniqueAssigneeIds, effectiveEndAt, effectiveStartAt, shootId, serviceName]
            );

            if (conflictRows.length > 0) {
                const err = new Error('One or more selected team members are already booked in this time range.');
                err.statusCode = 409;
                err.conflicts = conflictRows;
                throw err;
            }

            const assigneeValues = uniqueAssigneeIds.map(uid => [shootId, serviceName, uid]);
            await connection.query(
                'INSERT INTO shoot_assignments (shoot_id, service_name, employee_firebase_uid) VALUES ?',
                [assigneeValues]
            );

            const slotValues = uniqueAssigneeIds.map((uid) => [
                companyId,
                uid,
                shootId,
                serviceName,
                effectiveStartAt,
                effectiveEndAt,
                'booked',
            ]);
            await connection.query(
                `INSERT INTO team_assignment_slots
                 (company_id, member_uid, shoot_id, service_name, start_at, end_at, status)
                 VALUES ?`,
                [slotValues]
            );
        }
        
        // If everything succeeded, commit the changes to the database.
        await connection.commit();
        return { success: true, start_at: effectiveStartAt, end_at: effectiveEndAt };

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

exports.getShootById = async (shootId, companyId) => {
  const [rows] = await db.query(
    `
      SELECT 
        s.id, 
        s.title, 
        s.city AS location,     -- ✅ use 'city' as location
        CONCAT(s.date, ' ', s.time) AS date_time  -- ✅ merge date & time for message
      FROM shoots s
      JOIN projects p ON s.project_id = p.id
      WHERE s.id = ? AND p.company_id = ?
    `,
    [shootId, companyId]
  );
  return rows[0];
};

exports.getAssignmentAvailability = async (shootId, serviceName, startAt, endAt, companyId) => {
    const [[shoot]] = await db.query(
        `SELECT s.id, s.date, s.time
         FROM shoots s
         JOIN projects p ON p.id = s.project_id
         WHERE s.id = ? AND p.company_id = ?`,
        [shootId, companyId]
    );

    if (!shoot) {
        const err = new Error('Shoot not found or permission denied.');
        err.statusCode = 404;
        throw err;
    }

    const normalizedStartAt = toMySqlDateTime(startAt);
    const normalizedEndAt = toMySqlDateTime(endAt);
    const defaultSlot = buildDefaultSlotWindowFromShoot(shoot);
    const effectiveStartAt = normalizedStartAt || defaultSlot.start;
    const effectiveEndAt = normalizedEndAt || defaultSlot.end;

    if (!effectiveStartAt || !effectiveEndAt) {
        const err = new Error('Start and end time are required.');
        err.statusCode = 400;
        throw err;
    }
    if (new Date(effectiveEndAt) <= new Date(effectiveStartAt)) {
        const err = new Error('End time must be greater than start time.');
        err.statusCode = 400;
        throw err;
    }

    const [conflictRows] = await db.query(
        `SELECT
            tas.member_uid,
            e.name AS member_name,
            tas.start_at,
            tas.end_at,
            tas.shoot_id,
            tas.service_name,
            s.title AS shoot_title
         FROM team_assignment_slots tas
         JOIN employees e ON e.firebase_uid = tas.member_uid
         JOIN shoots s ON s.id = tas.shoot_id
         JOIN projects p ON p.id = s.project_id
         WHERE tas.company_id = ?
           AND p.company_id = ?
           AND tas.status = 'booked'
           AND tas.start_at < ?
           AND tas.end_at > ?
           AND NOT (tas.shoot_id = ? AND tas.service_name = ?)`,
        [companyId, companyId, effectiveEndAt, effectiveStartAt, shootId, serviceName || '']
    );

    return {
        startAt: effectiveStartAt,
        endAt: effectiveEndAt,
        unavailableMemberIds: [...new Set(conflictRows.map((r) => r.member_uid))],
        conflicts: conflictRows,
    };
};
