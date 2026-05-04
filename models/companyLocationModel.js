const db = require('../config/db');

const getActiveCompanyLocation = async (companyId) => {
  const [[location]] = await db.query(
    `
      SELECT
        id,
        company_id,
        location_name,
        address,
        latitude,
        longitude,
        radius_meters,
        is_active,
        created_at,
        updated_at
      FROM company_locations
      WHERE company_id = ? AND is_active = 1
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [companyId]
  );

  return location || null;
};

const upsertActiveCompanyLocation = async (companyId, location) => {
  const {
    id,
    location_name,
    address,
    latitude,
    longitude,
    radius_meters,
  } = location;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE company_locations SET is_active = 0 WHERE company_id = ? AND id <> ?`,
      [companyId, id]
    );

    await connection.query(
      `
        INSERT INTO company_locations
          (id, company_id, location_name, address, latitude, longitude, radius_meters, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          location_name = VALUES(location_name),
          address = VALUES(address),
          latitude = VALUES(latitude),
          longitude = VALUES(longitude),
          radius_meters = VALUES(radius_meters),
          is_active = 1
      `,
      [
        id,
        companyId,
        location_name || 'Office',
        address || null,
        latitude,
        longitude,
        radius_meters || 1000,
      ]
    );

    await connection.commit();
    return getActiveCompanyLocation(companyId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  getActiveCompanyLocation,
  upsertActiveCompanyLocation,
};
