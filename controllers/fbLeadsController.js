const axios = require('axios');
const db = require('../config/db');
const { getCompanyByOwnerUid } = require('../models/companyModel');
const { getFbPagesByCompanyId } = require('../models/fbAuthModel');
const fbLeadsModel = require('../models/fbLeadsModel');
const parseFBLead = require('../utils/parseFBLead');
const { sendEmailAutomation } = require('../utils/sendEmail');
const { sendAiSensyMessage } = require('../utils/sendAiSensyMessage');

const FB_GRAPH_VERSION = 'v16.0';

const createLimiter = (max) => {
  let active = 0;
  const queue = [];

  const next = () => {
    if (active >= max || queue.length === 0) return;
    const { fn, resolve, reject } = queue.shift();
    active += 1;
    Promise.resolve()
      .then(fn)
      .then(resolve)
      .catch(reject)
      .finally(() => {
        active -= 1;
        next();
      });
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
};

const limit = createLimiter(5);

const getLatestTimestamp = async (adminId) => {
  const [rows] = await db.query(
    `SELECT MAX(created_at) AS ts
     FROM leads
     WHERE admin_id = ? AND source = 'facebook'`,
    [adminId]
  );
  return rows[0]?.ts ? new Date(rows[0].ts) : null;
};

const pollFacebookLeads = async (req, res) => {
  try {
    const adminId = req.firebase_uid || req.user?.firebase_uid;
    if (!adminId) return res.status(400).json({ message: 'Admin ID missing' });

    const company = await getCompanyByOwnerUid(adminId);
    if (!company) {
      return res.status(400).json({ message: 'Company not found' });
    }

    const selections = await getFbPagesByCompanyId(company.id);
    if (!selections.length) {
      return res
        .status(400)
        .json({ message: 'No Facebook page selections found' });
    }

    const latestStored = await getLatestTimestamp(adminId);
    let newLeads = 0;

    await Promise.all(
      selections.map((sel) =>
        limit(async () => {
          const pageId = sel.page_id;
          const token = sel.page_access_token;
          if (!token) {
            console.error(`No token for page ${pageId}`);
            return;
          }

          const pageCreated = sel.created_at ? new Date(sel.created_at) : null;
          const startFrom =
            latestStored && pageCreated
              ? latestStored > pageCreated
                ? latestStored
                : pageCreated
              : latestStored || pageCreated;

          const sinceStr = startFrom
            ? `&since=${Math.floor((startFrom.getTime() + 1000) / 1000)}`
            : '';

          let formIds = [];
          let formNameMap = {};

          if (!formIds.length) {
            const f = await axios.get(
              `https://graph.facebook.com/${FB_GRAPH_VERSION}/${pageId}/leadgen_forms` +
                `?fields=id,name&access_token=${token}`
            );
            if (f.data?.error) {
              console.error('forms error', f.data.error);
              return;
            }
            formIds = f.data.data.map((d) => d.id);
            formNameMap = Object.fromEntries(
              f.data.data.map((d) => [d.id, d.name])
            );
          }

          await Promise.all(
            formIds.map((fid) =>
              limit(async () => {
                const l = await axios.get(
                  `https://graph.facebook.com/${FB_GRAPH_VERSION}/${fid}/leads` +
                    `?fields=id,created_time,field_data,ad_id,adgroup_id,campaign_id` +
                    `&access_token=${token}${sinceStr}`
                );

                if (l.data?.error) {
                  console.error(`leads err ${fid}`, l.data.error);
                  return;
                }

                const leads = Array.isArray(l.data.data) ? l.data.data : [];
                const batch = leads.map((raw) => {
                  const parsed = parseFBLead(raw);
                  return {
                    ...parsed,
                    fb_lead_id: raw.id,
                    admin_id: adminId,
                    source: 'facebook',
                    form_name: formNameMap[fid] || null,
                    raw_payload: raw,
                    created_time: parsed.created_time,
                  };
                });

                const ids = batch.map((b) => b.fb_lead_id);
                const existing = await fbLeadsModel.getExistingIds(ids);
                const toInsert = batch.filter((b) => !existing.has(b.fb_lead_id));

                await fbLeadsModel.bulkInsert(toInsert);
                newLeads += toInsert.length;

                if (toInsert.length) {
                  toInsert.forEach((lead) => {
                    sendEmailAutomation(lead, 'new_lead').catch((err) =>
                      console.error('Email error:', err)
                    );
                    sendAiSensyMessage(lead, 'new_lead').catch((err) =>
                      console.error('AiSensy error:', err)
                    );
                  });
                }
              })
            )
          );
        })
      )
    );

    return res.status(200).json({ message: 'Polling complete', newLeads });
  } catch (err) {
    console.error('pollFacebookLeads error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { pollFacebookLeads };
