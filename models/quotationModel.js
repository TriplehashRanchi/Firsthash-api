// File: models/quotationModel.js

const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Saves a new quotation record to the database.
 * It automatically calculates the correct version number.
 * @param {string} projectId - The ID of the project this quotation belongs to.
 * @param {string} fileUrl - The public URL of the generated PDF file.
 * @returns {Promise<{id: string, version: number}>} The ID and version of the new quotation.
 */
exports.saveQuotationRecord = async (projectId, fileUrl) => {
    // 1. Find the highest existing version number for this project to determine the new version.
    const [[latestQuote]] = await db.query(
        'SELECT MAX(version) as max_version FROM quotations WHERE project_id = ?',
        [projectId]
    );
    const newVersion = (latestQuote.max_version || 0) + 1;

    // 2. Generate a new UUID for this quotation record.
    const quotationId = uuidv4();

    // 3. Insert the new record into the database.
    await db.query(
        'INSERT INTO quotations (id, project_id, file_url, version) VALUES (?, ?, ?, ?)',
        [quotationId, projectId, fileUrl, newVersion]
    );

    // 4. Return the key details.
    return { id: quotationId, version: newVersion };
};