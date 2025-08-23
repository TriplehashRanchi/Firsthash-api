const {
    getCompanyByOwnerUid,
    updateCompanyByOwnerUid,
    deleteCompanyByOwnerUid,
    getCompanyById,   
    getCompanyByEmployeeUid,
} = require("../models/companyModel");

// This function can remain as is for public viewing.
const getCompanyByUid = async (req, res) => {
    try {
        const { firebase_uid } = req.params;
        const company = await getCompanyByOwnerUid(firebase_uid);
        if (!company) return res.status(404).json({ error: 'Company not found' });
        res.status(200).json(company);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ** FIXED UPDATE FUNCTION **
const updateCompany = async (req, res) => {
  try {
    // 1. Check if your `verifyToken` middleware successfully attached the UID.
    if (!req.firebase_uid) {
        // This would mean verifyToken failed or was skipped.
        return res.status(401).json({ error: "Authentication error: UID not attached to request." });
    }

    // *** THE FIX IS HERE ***
    // We now correctly get the UID from `req.firebase_uid`, which is what your middleware provides.
    const authenticated_uid = req.firebase_uid; 
    const incomingData = req.body;

    if (!incomingData || Object.keys(incomingData).length === 0) {
        return res.status(400).json({ error: "Missing update data in request body" });
    }

    // --- Data Sanitization (This is still a very important step) ---
    const allowedFields = [
        'name', 'logo', 'country', 'address_line_1', 'address_line_2',
        'city', 'state', 'pincode', 'tax_id', 'upi_id', 'bank_name',
        'bank_account_number', 'bank_ifsc_code', 'payment_qr_code_url',
    ];

    const sanitizedData = {};
    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(incomingData, key)) {
        sanitizedData[key] = incomingData[key] === '' ? null : incomingData[key];
      }
    }
    
    if (Object.keys(sanitizedData).length === 0) {
      return res.status(400).json({ error: "No valid fields provided for update." });
    }
    // --- End Sanitization ---

    const result = await updateCompanyByOwnerUid(authenticated_uid, sanitizedData);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Company not found, or data was unchanged.' });
    }

    const company = await getCompanyByOwnerUid(authenticated_uid);
    res.status(200).json(company);

  } catch (err) {
    console.error('Error updating company:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// **FIXED DELETE FUNCTION**
const deleteCompany = async (req, res) => {
    try {
        if (!req.firebase_uid) {
            return res.status(401).json({ error: "Authentication error: UID not attached to request." });
        }
        // *** THE FIX IS ALSO HERE ***
        const authenticated_uid = req.firebase_uid;

        const result = await deleteCompanyByOwnerUid(authenticated_uid);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Company not found to delete.' });
        }
        
        res.status(200).json({ message: 'Company deleted successfully' });

    } catch (err) {
        console.error('Error deleting company:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ✅ NEW: get company by its ID (works for employees)
const getCompanyByIdController = async (req, res) => {
  try {
    const { company_id } = req.params;
    if (!company_id) {
      return res.status(400).json({ error: 'company_id is required' });
    }
    const company = await getCompanyById(company_id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    return res.status(200).json(company);
  } catch (err) {
    console.error('getCompanyByIdController error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getCompanyForEmployee = async (req, res) => {
    try {
        const { firebase_uid } = req.params;
        const company = await getCompanyByEmployeeUid(firebase_uid);
        if (!company) {
            return res.status(404).json({ error: 'Company not found for this employee.' });
        }
        res.status(200).json(company);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { 
    getCompanyByUid, 
    updateCompany,
    deleteCompany,
    getCompanyByIdController,
    getCompanyForEmployee
};