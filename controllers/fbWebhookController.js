const axios = require('axios');
const fbLeadsModel = require('../models/fbLeadsModel');
const parseFBLead = require('../utils/parseFBLead');
const { sendEmailAutomation } = require('../utils/sendEmail');
const { sendAiSensyMessage } = require('../utils/sendAiSensyMessage');
const {
  getFbPageCandidatesByPageId,
} = require('../models/fbAuthModel');

const FB_GRAPH_VERSION = 'v16.0';
const LEAD_FIELDS = 'id,created_time,field_data,ad_id,campaign_id';

const fetchLeadByToken = async (leadgenId, accessToken) => {
  const response = await axios.get(
    `https://graph.facebook.com/${FB_GRAPH_VERSION}/${leadgenId}`,
    {
      params: {
        access_token: accessToken,
        fields: LEAD_FIELDS,
      },
    }
  );

  return response.data;
};

const buildTokenCandidates = async (pageId) => {
  const candidates = [];
  const pages = await getFbPageCandidatesByPageId(pageId);
  for (const page of pages) {
    if (!page?.admin_id || !page?.page_access_token) continue;
    candidates.push({
      admin_id: page.admin_id,
      page_access_token: page.page_access_token,
      source: 'fb_pages',
      matched_form: true,
      updated_at: page.updated_at || page.created_at || null,
    });
  }

  return candidates.sort((a, b) => {
    if (a.matched_form !== b.matched_form) return a.matched_form ? -1 : 1;
    if (a.source !== b.source) return a.source === 'fb_pages' ? -1 : 1;
    return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
  });
};

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

  if (!leadgenId || !pageId) {
    console.warn('Webhook skipped: missing leadgen_id or page_id', change?.value);
    return;
  }

  const candidates = await buildTokenCandidates(pageId);
  if (!candidates.length) {
    console.warn(
      `Webhook skipped: no admin/token mapping found for page ${pageId}`
    );
    return;
  }

  let selectedCandidate = null;
  let raw = null;
  const tokenErrors = [];
  const seenTokens = new Set();

  for (const candidate of candidates) {
    const token = candidate.page_access_token;
    if (!token || seenTokens.has(token)) continue;
    seenTokens.add(token);

    try {
      const leadData = await fetchLeadByToken(leadgenId, token);
      if (leadData?.error) {
        tokenErrors.push({
          admin_id: candidate.admin_id,
          source: candidate.source,
          error: leadData.error,
        });
        continue;
      }

      selectedCandidate = candidate;
      raw = leadData;
      break;
    } catch (error) {
      tokenErrors.push({
        admin_id: candidate.admin_id,
        source: candidate.source,
        error: error?.response?.data || error.message,
      });
    }
  }

  if (!selectedCandidate || !raw) {
    console.error(
      `Webhook lead fetch failed for leadgen_id ${leadgenId}. Tried ${seenTokens.size} token(s).`,
      tokenErrors
    );
    return;
  }

  const parsed = parseFBLead(raw);

  const existing = await fbLeadsModel.leadExists(raw.id);
  if (existing) {
    console.log(`Webhook skipped duplicate lead: ${raw.id}`);
    return;
  }

  const leadToInsert = {
    ...parsed,
    fb_lead_id: raw.id,
    admin_id: selectedCandidate.admin_id,
    source: 'facebook',
    form_name: null,
    raw_payload: raw,
  };

  await fbLeadsModel.insertLead(leadToInsert);
  console.log(
    `Webhook inserted lead ${raw.id} for admin ${selectedCandidate.admin_id} via ${selectedCandidate.source}`
  );

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
