const {
 getCompanyByOwnerUid,
 updateCompanyByOwnerUid, // Import the new model function
 deleteCompanyByOwnerUid,
 // createCompany is also available if you need it
} = require("../models/companyModel");

const getCompanyByUid = async (req, res) => {
  try {
    const { firebase_uid } = req.params;

    if (!firebase_uid) {
      return res.status(400).json({ error: 'Missing UID' });
    }

    const company = await getCompanyByOwnerUid(firebase_uid);

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.status(200).json(company);
  } catch (err) {
    console.error('Error fetching company:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * NEW CONTROLLER FOR UPDATING
 * This handles the API request to update a company's profile.
 */
const updateCompany = async (req, res) => {
  try {
    const { firebase_uid } = req.params;
    const updatedData = req.body; // The new data comes from the request body

    if (!firebase_uid) {
        return res.status(400).json({ error: "Missing UID in URL" });
    }
    if (!updatedData || Object.keys(updatedData).length === 0) {
        return res.status(400).json({ error: "Missing update data in request body" });
    }

    // Call the model function to update the database
    const result = await updateCompanyByOwnerUid(firebase_uid, updatedData);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Company not found or no new data to update' });
    }

    // After updating, fetch the complete, updated company profile and send it back
    const company = await getCompanyByOwnerUid(firebase_uid);
    res.status(200).json(company);

  } catch (err) {
    console.error('Error updating company:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// You should also have a delete controller
const deleteCompany = async (req, res) => {
    try {
        const { firebase_uid } = req.params;
        const result = await deleteCompanyByOwnerUid(firebase_uid);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }
        res.status(200).json({ message: 'Company deleted successfully' });
    } catch (err) {
        console.error('Error deleting company:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { getCompanyByUid, updateCompany, deleteCompany };