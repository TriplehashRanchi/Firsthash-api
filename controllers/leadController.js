const leadModel = require('../models/leadModel');

const createLead = async (req, res) => {
  try {

    const knownDbColumns = new Set([
      'admin_id', 'full_name', 'email', 'phone_number', 'address', 'date',
      'gender', 'company_name', 'event_location', 'event_month', 'coverage_amount'
    ]);
    console.log("IN CREATE LEAD, REQ.BODY:", req.body);

    const leadDataForDB = {};
    const customFields = [];

   
    for (const key in req.body) {
      if (knownDbColumns.has(key)) {
        // If it's a known column, add it to the main DB object
        leadDataForDB[key] = req.body[key] || null;
      } else {
        // If it's not a known column, treat it as a custom field
        customFields.push({ name: key, value: req.body[key] });
      }
    }

    if (!leadDataForDB.admin_id || !leadDataForDB.full_name || !leadDataForDB.email) {
      return res.status(400).json({ message: 'Error: A required field (like Admin ID, Name, or Email) is missing.' });
    }

    if (customFields.length > 0) {
      leadDataForDB.raw_payload = JSON.stringify(customFields);
    }

    const newLead = await leadModel.createLead(leadDataForDB);

    res.status(201).json({
      message: "Thank you! Your information has been received.",
      lead: newLead
    });

  } catch (error) {
    console.error('Error creating lead from embed form:', error);
    res.status(500).json({ message: "An unexpected error occurred on the server." });
  }
};


const getAllLeads = async (req, res) => {
  try {
    const { admin_id } = req.params;
    console.log("admin_id:", admin_id);
    if (!admin_id) {
        return res.status(400).json({ message: 'Admin ID is required.' });
    }

    const leads = await leadModel.getAllLeadsByAdmin(admin_id);

    // Before sending, parse the JSON string in raw_payload back into an object
    const formattedLeads = leads.map(lead => {
        if (lead.raw_payload && typeof lead.raw_payload === 'string') {
            try {
                return { ...lead, raw_payload: JSON.parse(lead.raw_payload) };
            } catch (e) {
                return lead; // Return as is if parsing fails
            }
        }
        return lead;
    });

    res.status(200).json(formattedLeads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateStatus = async (req, res) => {
    try {
        const { leadId } = req.params;
        // Expect 'lead_status' in the request body now
        const { lead_status } = req.body;

        if (!lead_status) {
            return res.status(400).json({ message: 'Lead status is required.' });
        }

        const affectedRows = await leadModel.updateLeadStatus(leadId, lead_status);

        if (affectedRows === 0) {
            return res.status(404).json({ message: 'Lead not found or status unchanged.' });
        }

        res.status(200).json({ message: `Lead status updated to ${lead_status}` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
  createLead,
  getAllLeads,
  updateStatus
};