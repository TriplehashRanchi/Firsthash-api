const { getCompanyByOwnerUid } = require("../models/companyModel");

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

module.exports = { getCompanyByUid };