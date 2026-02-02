const axios = require('axios');
const fbLeadsModel = require('../models/fbLeadsModel');
const parseFBLead = require('../utils/parseFBLead');
const { sendEmailAutomation } = require('../utils/sendEmail');
const { sendAiSensyMessage } = require('../utils/sendAiSensyMessage');
const {
  getFbPageByPageId,
  getFbConnectionByCompanyId,
} = require('../models/fbAuthModel');

const FB_GRAPH_VERSION = 'v16.0';

const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.FB_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.status(403).send('Forbidden');
};

const handleLeadgen = async (change) => {
  const leadgenId = change?.value?.leadgen_id;
  const pageId = change?.value?.page_id;

  if (!leadgenId || !pageId) return;

  const page = await getFbPageByPageId(pageId);
  if (!page?.page_access_token) return;

  const leadResponse = await axios.get(
    `https://graph.facebook.com/${FB_GRAPH_VERSION}/${leadgenId}`,
    {
      params: {
        access_token: page.page_access_token,
        fields: 'id,created_time,field_data,ad_id,adgroup_id,campaign_id',
      },
    }
  );

  if (leadResponse?.data?.error) return;

  const raw = leadResponse.data;
  const parsed = parseFBLead(raw);

  const existing = await fbLeadsModel.leadExists(raw.id);
  if (existing) return;

  const connection = await getFbConnectionByCompanyId(page.company_id);
  const adminId = connection?.admin_firebase_uid || null;

  if (!adminId) return;

  const leadToInsert = {
    ...parsed,
    fb_lead_id: raw.id,
    admin_id: adminId,
    source: 'facebook',
    form_name: null,
    raw_payload: raw,
  };

  await fbLeadsModel.insertLead(leadToInsert);

  sendEmailAutomation(leadToInsert, 'new_lead').catch((err) =>
    console.error('Email error:', err)
  );
  sendAiSensyMessage(leadToInsert, 'new_lead').catch((err) =>
    console.error('AiSensy error:', err)
  );
};

const receiveWebhook = async (req, res) => {
  try {
    const body = req.body;
    console.log('FB webhook payload:', JSON.stringify(body));
    if (body?.object !== 'page') {
      return res.sendStatus(200);
    }

    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change.field === 'leadgen') {
          await handleLeadgen(change);
        }
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('receiveWebhook error:', error);
    return res.sendStatus(200);
  }
};

module.exports = {
  verifyWebhook,
  receiveWebhook,
};
