const db = require('../config/db');

const getCompanyForAdmin = async (adminId) => {
  const [ownerRows] = await db.query(
    `SELECT id FROM companies WHERE owner_admin_uid = ? LIMIT 1`,
    [adminId]
  );
  if (ownerRows[0]?.id) return ownerRows[0].id;

  const [employeeRows] = await db.query(
    `
    SELECT c.id
    FROM companies c
    JOIN employees e ON e.company_id = c.id
    WHERE e.firebase_uid = ?
    LIMIT 1
    `,
    [adminId]
  );
  return employeeRows[0]?.id || null;
};

const saveFbPages = async (adminId, selectionData) => {
  const companyId = await getCompanyForAdmin(adminId);
  if (!companyId) throw new Error('Company not found for admin');

  const [connectionRows] = await db.query(
    `
    SELECT fb_user_id
    FROM fb_connections
    WHERE company_id = ? AND status = 'active'
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [companyId]
  );
  const fbUserId = connectionRows[0]?.fb_user_id || '';

  const selections = Array.isArray(selectionData)
    ? selectionData
    : [selectionData];

  const query = `
    INSERT INTO fb_pages
      (id, company_id, fb_user_id, page_id, page_name, page_access_token, page_token_expires_at, is_subscribed)
    VALUES
      (UUID(), ?, ?, ?, ?, ?, NULL, ?)
    ON DUPLICATE KEY UPDATE
      page_name = VALUES(page_name),
      page_access_token = VALUES(page_access_token),
      is_subscribed = VALUES(is_subscribed),
      updated_at = CURRENT_TIMESTAMP
  `;

  for (const selection of selections) {
    const pageId = selection.pageId || selection.page_id;
    const pageName = selection.pageName || selection.page_name || null;
    const pageAccessToken =
      selection.pageAccessToken || selection.page_access_token || null;
    if (!pageId || !pageAccessToken) continue;

    const values = [
      companyId,
      fbUserId,
      pageId,
      pageName,
      pageAccessToken,
      selection.is_subscribed ? 1 : 0,
    ];
    await db.query(query, values);
  }
};

const getSavedFbPages = async (adminId) => {
  const [rows] = await db.query(
    `
    SELECT p.*
    FROM fb_pages p
    JOIN fb_connections c ON c.company_id = p.company_id
      AND c.fb_user_id = p.fb_user_id
    WHERE c.admin_firebase_uid = ? AND c.status = 'active'
    ORDER BY p.updated_at DESC
    `,
    [adminId]
  );
  return rows;
};

const getSavedFbPageByPageId = async (pageId) => {
  const [rows] = await db.query(
    `
    SELECT
      p.*,
      c.admin_firebase_uid AS admin_id
    FROM fb_pages p
    LEFT JOIN fb_connections c ON c.company_id = p.company_id
      AND c.fb_user_id = p.fb_user_id
      AND c.status = 'active'
    WHERE p.page_id = ?
    ORDER BY p.updated_at DESC, c.updated_at DESC
    LIMIT 1
    `,
    [pageId]
  );
  return rows[0] || null;
};

const getSavedFbPagesByPageId = async (pageId) => {
  const [rows] = await db.query(
    `
    SELECT
      p.*,
      c.admin_firebase_uid AS admin_id
    FROM fb_pages p
    LEFT JOIN fb_connections c ON c.company_id = p.company_id
      AND c.fb_user_id = p.fb_user_id
      AND c.status = 'active'
    WHERE p.page_id = ?
    ORDER BY p.updated_at DESC, c.updated_at DESC
    `,
    [pageId]
  );
  return rows;
};

const deleteSavedFbPages = async (adminId, pageId) => {
  const companyId = await getCompanyForAdmin(adminId);
  if (!companyId) return { affectedRows: 0 };

  const [result] = await db.query(
    `DELETE FROM fb_pages WHERE company_id = ? AND page_id = ?`,
    [companyId, pageId]
  );
  return result;
};

const deleteAllSavedFbPages = async (adminId) => {
  const companyId = await getCompanyForAdmin(adminId);
  if (!companyId) return { affectedRows: 0 };

  const [result] = await db.query(`DELETE FROM fb_pages WHERE company_id = ?`, [
    companyId,
  ]);
  return result;
};

module.exports = {
  saveFbPages,
  getSavedFbPages,
  getSavedFbPageByPageId,
  getSavedFbPagesByPageId,
  deleteSavedFbPages,
  deleteAllSavedFbPages,
};
