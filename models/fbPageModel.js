const db = require('../config/db');

const saveFbPages = async (adminId, selectionData) => {
  try {
    const selections = Array.isArray(selectionData)
      ? selectionData
      : [selectionData];

    for (const selection of selections) {
      const { pageId, pageName, pageAccessToken, formIds } = selection;
      const formIdsStr = formIds ? JSON.stringify(formIds) : null;
      const query = `
        INSERT INTO fb_page_selections (admin_id, page_id, page_name, page_access_token, form_ids)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          page_name = VALUES(page_name),
          page_access_token = VALUES(page_access_token),
          form_ids = VALUES(form_ids),
          updated_at = CURRENT_TIMESTAMP
      `;
      const values = [adminId, pageId, pageName, pageAccessToken, formIdsStr];
      await db.query(query, values);
    }
  } catch (error) {
    throw new Error(`Error saving Facebook page selection(s): ${error.message}`);
  }
};

const getSavedFbPages = async (adminId) => {
  try {
    const query = `SELECT * FROM fb_page_selections WHERE admin_id = ?`;
    const [rows] = await db.query(query, [adminId]);
    return rows;
  } catch (error) {
    throw new Error(`Error retrieving saved Facebook pages: ${error.message}`);
  }
};

const deleteSavedFbPages = async (adminId, pageId) => {
  try {
    const query = `DELETE FROM fb_page_selections WHERE admin_id = ? AND page_id = ?`;
    const [rows] = await db.query(query, [adminId, pageId]);
    return rows;
  } catch (error) {
    throw new Error(`Error deleting saved Facebook pages: ${error.message}`);
  }
};

const deleteAllSavedFbPages = async (adminId) => {
  try {
    const query = `DELETE FROM fb_page_selections WHERE admin_id = ?`;
    const [rows] = await db.query(query, [adminId]);
    return rows;
  } catch (error) {
    throw new Error(`Error deleting all saved Facebook pages: ${error.message}`);
  }
};

module.exports = {
  saveFbPages,
  getSavedFbPages,
  deleteSavedFbPages,
  deleteAllSavedFbPages,
};
