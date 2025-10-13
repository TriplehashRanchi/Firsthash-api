const db = require('../config/db'); // Adjust path as per your structure

// 1. Get all clients for a specific company
const getClientsByCompany = async (company_id) => {
  const [rows] = await db.query(
    'SELECT * FROM clients WHERE company_id = ?',
    [company_id]
  );
  return rows;
};

// 2. Get a single client by ID
const getClientById = async (client_id) => {
  const [rows] = await db.query(
    'SELECT * FROM clients WHERE client_id = ?',
    [client_id]
  );
  return rows[0] || null;
};

// 3. Create a new client
const createClient = async (clientData) => {
  const {
    company_id,
    name,
    email,
    phone,
    address,
    notes,
  } = clientData;

  const [result] = await db.query(
    `INSERT INTO clients (company_id, name, email, phone, address, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [company_id, name, email, phone, address, notes]
  );
  
  return result.insertId;
};

// 4. Update an existing client
const updateClient = async (client_id, updatedData) => {
  const fields = [];
  const values = [];

  for (const key in updatedData) {
    fields.push(`${key} = ?`);
    values.push(updatedData[key]);
  }

  if (fields.length === 0) return false;

  values.push(client_id);

  const [result] = await db.query(
    `UPDATE clients SET ${fields.join(', ')} WHERE client_id = ?`,
    values
  );

  return result.affectedRows > 0;
};

// 5. Delete a client
// const deleteClient = async (client_id) => {
//   const [result] = await db.query(
//     'DELETE FROM clients WHERE client_id = ?',
//     [client_id]
//   );
//   return result.affectedRows > 0;
// };


const deleteClient = async (id) => {
  const [result] = await db.query(
    'DELETE FROM clients WHERE id = ?',
    [id]
  );
  return result.affectedRows > 0;
};

// 6. Get client by phone number (for a specific company)
const getClientByPhone = async (phone, company_id) => {
  const [rows] = await db.query(
    'SELECT * FROM clients WHERE phone = ? AND company_id = ? LIMIT 1',
    [phone, company_id]
  );
  return rows[0] || null;
};


// --- NEW: get all projects for a specific client (scoped by company) ---
const getClientsWithProjects = async (company_id) => {
  // This query is compatible with older MySQL and MariaDB versions.
  // It uses GROUP_CONCAT to build a string of JSON objects and then wraps it in brackets.
  const [clients] = await db.query(
    `
    SELECT
      c.id,
      c.name,
      c.email,
      c.phone,
      c.created_at,
      -- This COALESCE handles clients with no projects, returning a clean '[]'.
      COALESCE(
        CONCAT('[',
          GROUP_CONCAT(
            -- We only create a JSON object if there is a project.
            CASE
              WHEN p.id IS NOT NULL THEN
                JSON_OBJECT(
                  'projectId', p.id,
                  'name', p.name,
                  'event', p.status,
                  'date', (SELECT MIN(s.date) FROM shoots s WHERE s.project_id = p.id)
                )
              ELSE NULL
            END
          ),
        ']'),
        '[]'
      ) AS projects
    FROM
      clients AS c
    LEFT JOIN
      projects AS p ON c.id = p.client_id
    WHERE
      c.company_id = ?
    GROUP BY
      c.id
    ORDER BY
      c.created_at DESC; -- ✅ newest clients first
    `,
    [company_id]
  );

  // Split the full 'name' into 'firstName' and 'lastName' and parse the projects JSON string.
  return clients.map(client => ({
    ...client,
    firstName: client.name ? client.name.split(' ')[0] : '',
    lastName: client.name ? client.name.split(' ').slice(1).join(' ') : '',
    projects: JSON.parse(client.projects), // The query returns a string, so we parse it into an array
  }));
};

const updateClientFromDetailsPage = async (id, clientData) => {
  // This function is designed to work ONLY with the data from your new frontend page.
  
  // 1. Safely get the data from the form
  const { firstName, lastName, email, phone } = clientData;

  // 2. Combine firstName and lastName into the 'name' field the database needs
  const name = `${firstName || ''} ${lastName || ''}`.trim();

  // 3. The SQL query uses the correct column name 'id' in the WHERE clause.
  //    It only updates the specific fields from this form.
  const [result] = await db.query(
    `UPDATE clients SET name = ?, email = ?, phone = ? WHERE id = ?`,
    [name, email, phone, id]
  );

  return result.affectedRows > 0;
};

const updateClientFromManagerPage = async (id, clientData) => {
  // This function is built specifically for the form on your manager's page.
  
  // 1. Prepare the data: combine firstName and lastName into the 'name' field
  const dataToUpdate = {
    name: `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim(),
    email: clientData.email,
    phone: clientData.phone,
  };

  // 2. Build the SQL query parts
  const fields = Object.keys(dataToUpdate).map(key => `${key} = ?`).join(', ');
  const values = Object.values(dataToUpdate);
  values.push(id); // Add the ID for the WHERE clause

  // 3. The SQL query uses the correct column name 'id' in the WHERE clause.
  const [result] = await db.query(
    `UPDATE clients SET ${fields} WHERE id = ?`,
    values
  );

  return result.affectedRows > 0;
};


module.exports = {
  getClientsByCompany,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientByPhone,
  getClientsWithProjects,
  updateClientFromDetailsPage,
  updateClientFromManagerPage
};
