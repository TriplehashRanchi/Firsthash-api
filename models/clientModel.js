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
const deleteClient = async (client_id) => {
  const [result] = await db.query(
    'DELETE FROM clients WHERE client_id = ?',
    [client_id]
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


module.exports = {
  getClientsByCompany,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientByPhone
};
