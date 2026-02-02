const db = require('../config/db');

const createFBLead = async (fbLeadData) => {
  try {
    const leadData = {
      fb_leadgen_id: fbLeadData.leadgen_id,
      form_id: fbLeadData.form_id,
      page_id: fbLeadData.page_id,
      ad_id: fbLeadData.ad_id,
      created_time: new Date(fbLeadData.created_time * 1000),
      source: 'facebook',
    };

    const [results] = await db.query('INSERT INTO fb_leads SET ?', [leadData]);
    return { id: results.insertId, ...leadData };
  } catch (err) {
    throw new Error(`Error adding new Facebook lead: ${err.message}`);
  }
};

module.exports = {
  createFBLead,
};
