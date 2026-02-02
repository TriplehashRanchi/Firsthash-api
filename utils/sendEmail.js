const sendEmailAutomation = async (lead, eventName) => {
  if (!lead) return;
  console.log(`Email automation skipped (${eventName || 'event'}) for lead`, {
    leadId: lead.fb_lead_id || lead.id,
  });
};

module.exports = { sendEmailAutomation };
