const db = require('../config/db');

/**
 * Gets all deliverable bundles for a specific company, including their items.
 * The items are retrieved from the 'items_json' column and parsed.
 * @param {number} company_id The ID of the company.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of bundle objects.
 */
exports.getDeliverableBundles = async (company_id) => {
  const globalCompanyId = '00000000-0000-0000-0000-000000000000'; // Define the special ID for global bundles.

  // The SQL query now uses 'IN' to select bundles that match the company's ID OR the global ID.
  // A CASE statement is used to create the 'type' field in the result set.
  const [rows] = await db.query(
    `SELECT
      id,
      bundle_name,
      items_json,
      CASE
        WHEN company_id = ? THEN 'global'
        ELSE 'company'
      END AS type
    FROM deliverable_bundles
    WHERE company_id IN (?, ?)
    ORDER BY type ASC, bundle_name ASC`,
    [globalCompanyId, globalCompanyId, company_id]
  );

  return rows.map(bundle => {
    let items = [];
    try {
      items = JSON.parse(bundle.items_json) || [];
    } catch (error) {
      console.error(`Error parsing items_json for bundle ID ${bundle.id}:`, error);
      items = [];
    }
    
    // Return the full object, now including the new 'type' field.
    return {
      id: bundle.id,
      bundle_name: bundle.bundle_name,
      items: items,
      type: bundle.type // This will be 'global' or 'company'
    };
  });
};


/**
 * Adds a new deliverable bundle for a company. The bundle items are
 * converted to a JSON string and stored in the 'items_json' column.
 * @param {number} company_id The ID of the company.
 * @param {string} name The name of the new bundle.
 * @param {Array<object>} items An array of item objects (e.g., [{ title: 'Photo Album' }]).
 * @returns {Promise<number>} A promise that resolves to the ID of the newly inserted bundle.
 */
exports.addDeliverableBundle = async (company_id, bundle_name, items = []) => {
  console.log('➡️ addDeliverableBundle called with:');
  console.log('Company ID:', company_id);
  console.log('Bundle Name:', bundle_name);
  console.log('Items:', items);

  try {
    const itemsJsonString = JSON.stringify(items);
    console.log('📦 Serialized Items JSON:', itemsJsonString);

    const [result] = await db.query(
      `INSERT INTO deliverable_bundles (company_id, bundle_name, items_json) VALUES (?, ?, ?)`,
      [company_id, bundle_name, itemsJsonString]
    );

    console.log('✅ Insert successful, insertId:', result.insertId);
    return result.insertId;

  } catch (error) {
    console.error('❌ Error in addDeliverableBundle:', error);
    throw error;
  }
};


/**
 * Deletes a deliverable bundle by its ID. Because items are stored in the same
 * table, only a single delete operation is required.
 * @param {number} id The ID of the bundle to delete.
 * @returns {Promise<void>}
 */
exports.deleteDeliverableBundle = async (id) => {
  // With the items_json schema, we only need to delete the main bundle row.
  await db.query(`DELETE FROM deliverable_bundles WHERE id = ?`, [id]);
};

// The function getItemsForBundle is no longer needed with this schema and has been removed.
exports.updateDeliverableBundle = async (bundle_id, company_id, items = []) => {
  const itemsJsonString = JSON.stringify(items);

  // The WHERE clause is crucial for security. It ensures a user can only
  // update a bundle if the ID and their company_id match the same row.
  await db.query(
    `UPDATE deliverable_bundles SET items_json = ? WHERE id = ? AND company_id = ?`,
    [itemsJsonString, bundle_id, company_id]
  );
};
