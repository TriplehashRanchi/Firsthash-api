const db = require('../config/db');

const upsertFbConnection = async ({
  company_id,
  admin_firebase_uid,
  fb_user_id,
  fb_user_name,
  access_token,
  token_expires_at,
}) => {
  const query = `
    INSERT INTO fb_connections
      (id, company_id, admin_firebase_uid, fb_user_id, fb_user_name, access_token, token_expires_at, status)
    VALUES
      (UUID(), ?, ?, ?, ?, ?, ?, 'active')
    ON DUPLICATE KEY UPDATE
      admin_firebase_uid = VALUES(admin_firebase_uid),
      fb_user_name = VALUES(fb_user_name),
      access_token = VALUES(access_token),
      token_expires_at = VALUES(token_expires_at),
      status = 'active',
      updated_at = CURRENT_TIMESTAMP
  `;

  const values = [
    company_id,
    admin_firebase_uid,
    fb_user_id,
    fb_user_name,
    access_token,
    token_expires_at,
  ];

  const [result] = await db.query(query, values);
  return result;
};

const upsertFbPages = async (company_id, fb_user_id, pages = []) => {
  if (!Array.isArray(pages) || pages.length === 0) return;

  const query = `
    INSERT INTO fb_pages
      (id, company_id, fb_user_id, page_id, page_name, page_access_token, page_token_expires_at, is_subscribed)
    VALUES
      (UUID(), ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      page_name = VALUES(page_name),
      page_access_token = VALUES(page_access_token),
      page_token_expires_at = VALUES(page_token_expires_at),
      is_subscribed = VALUES(is_subscribed),
      updated_at = CURRENT_TIMESTAMP
  `;

  for (const page of pages) {
    const values = [
      company_id,
      fb_user_id,
      page.page_id,
      page.page_name || null,
      page.page_access_token,
      page.page_token_expires_at || null,
      page.is_subscribed ? 1 : 0,
    ];
    await db.query(query, values);
  }
};

const markPagesSubscribed = async (company_id, pageIds = []) => {
  if (!Array.isArray(pageIds) || pageIds.length === 0) return;

  const placeholders = pageIds.map(() => '?').join(',');
  const query = `
    UPDATE fb_pages
    SET is_subscribed = 1, updated_at = CURRENT_TIMESTAMP
    WHERE company_id = ? AND page_id IN (${placeholders})
  `;
  const values = [company_id, ...pageIds];
  await db.query(query, values);
};

const getFbConnectionByCompanyId = async (company_id) => {
  const [rows] = await db.query(
    `
    SELECT *
    FROM fb_connections
    WHERE company_id = ? AND status = 'active'
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [company_id]
  );
  return rows[0] || null;
};

const deleteFbPagesByCompanyId = async (company_id) => {
  await db.query(`DELETE FROM fb_pages WHERE company_id = ?`, [company_id]);
};

const getFbPagesByCompanyId = async (company_id) => {
  const [rows] = await db.query(
    `SELECT * FROM fb_pages WHERE company_id = ?`,
    [company_id]
  );
  return rows;
};

const getFbPageByPageId = async (page_id) => {
  const [rows] = await db.query(
    `SELECT * FROM fb_pages WHERE page_id = ? LIMIT 1`,
    [page_id]
  );
  return rows[0] || null;
};

module.exports = {
  upsertFbConnection,
  upsertFbPages,
  markPagesSubscribed,
  getFbConnectionByCompanyId,
  deleteFbPagesByCompanyId,
  getFbPagesByCompanyId,
  getFbPageByPageId,
};
