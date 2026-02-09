const axios = require('axios');
const {
  getFbConnectionByCompanyId,
  getFbPagesByCompanyId,
  upsertFbPages,
  markPagesSubscribed,
  deleteFbPagesByCompanyId,
  deleteFbPageByCompanyIdAndPageId,
} = require('../models/fbAuthModel');
const {
  getCompanyByOwnerUid,
  getCompanyByEmployeeUid,
} = require('../models/companyModel');

const FB_GRAPH_VERSION = 'v16.0';

const getCompanyForAdmin = async (firebaseUid) => {
  if (!firebaseUid) return null;
  return (
    (await getCompanyByOwnerUid(firebaseUid)) ||
    (await getCompanyByEmployeeUid(firebaseUid))
  );
};

const saveFbPages = async (req, res) => {
  try {
    const adminId = req.firebase_uid || req.user?.firebase_uid || req.body?.userId;
    const { selections } = req.body;
    if (!adminId || !selections || !Array.isArray(selections)) {
      return res.status(400).json({ message: 'Invalid payload' });
    }

    const company = await getCompanyForAdmin(adminId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const connection = await getFbConnectionByCompanyId(company.id);
    if (!connection?.fb_user_id) {
      return res.status(400).json({ message: 'Facebook not connected' });
    }
    const rows = selections
      .map((selection) => ({
        page_id: selection.pageId || selection.page_id,
        page_name: selection.pageName || selection.page_name || null,
        page_access_token:
          selection.pageAccessToken || selection.page_access_token || null,
        page_token_expires_at: null,
        is_subscribed: selection.is_subscribed ? 1 : 0,
      }))
      .filter((row) => row.page_id && row.page_access_token);

    if (!rows.length) {
      return res
        .status(400)
        .json({ message: 'No valid page rows with access token' });
    }

    await upsertFbPages(company.id, connection.fb_user_id, rows);

    return res
      .status(200)
      .json({ message: 'Facebook page selections saved successfully' });
  } catch (error) {
    console.error('Error saving Facebook page selections:', error.message);
    return res.status(500).json({ message: error.message });
  }
};

const getSavedFbPages = async (req, res) => {
  try {
    const adminId = req.firebase_uid || req.user?.firebase_uid;
    if (!adminId) {
      return res.status(400).json({ message: 'Admin ID is missing' });
    }

    const company = await getCompanyForAdmin(adminId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const pages = await getFbPagesByCompanyId(company.id);
    return res.status(200).json({ data: pages });
  } catch (error) {
    console.error('Error retrieving saved Facebook pages:', error.message);
    return res.status(500).json({ message: error.message });
  }
};

const deleteSavedFbPages = async (req, res) => {
  try {
    const adminId = req.firebase_uid || req.user?.firebase_uid;
    const pageID = req.params.pageID;
    if (!adminId) {
      return res.status(400).json({ message: 'Admin ID is missing' });
    }

    const company = await getCompanyForAdmin(adminId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const result = await deleteFbPageByCompanyIdAndPageId(company.id, pageID);
    return res.status(200).json({ data: result });
  } catch (error) {
    console.error('Error retrieving saved Facebook pages:', error.message);
    return res.status(500).json({ message: error.message });
  }
};

const deleteAllSavedFbPages = async (req, res) => {
  try {
    const adminId = req.firebase_uid || req.user?.firebase_uid;
    if (!adminId) {
      return res.status(400).json({ message: 'Admin ID is missing' });
    }

    const company = await getCompanyForAdmin(adminId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    await deleteFbPagesByCompanyId(company.id);
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting all FB pages:', error);
    return res.status(500).json({ message: error.message });
  }
};

const getAvailableFbPages = async (req, res) => {
  try {
    const company = await getCompanyForAdmin(req.firebase_uid);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const connection = await getFbConnectionByCompanyId(company.id);
    if (!connection?.access_token) {
      return res.status(400).json({ message: 'Facebook not connected' });
    }
    if (!connection?.fb_user_id) {
      return res.status(400).json({ message: 'Facebook connection is incomplete' });
    }

    const pagesResponse = await axios.get(
      `https://graph.facebook.com/${FB_GRAPH_VERSION}/me/accounts`,
      { params: { access_token: connection.access_token, fields: 'id,name' } }
    );

    const pages = Array.isArray(pagesResponse?.data?.data)
      ? pagesResponse.data.data
      : [];

    return res.status(200).json({ data: pages });
  } catch (error) {
    console.error('Error fetching available Facebook pages:', error);
    return res.status(500).json({ message: error.message });
  }
};

const selectFbPages = async (req, res) => {
  try {
    const { pageIds } = req.body;
    if (!Array.isArray(pageIds) || pageIds.length === 0) {
      return res.status(400).json({ message: 'pageIds is required' });
    }

    const company = await getCompanyForAdmin(req.firebase_uid);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const connection = await getFbConnectionByCompanyId(company.id);
    if (!connection?.access_token) {
      return res.status(400).json({ message: 'Facebook not connected' });
    }

    const pagesResponse = await axios.get(
      `https://graph.facebook.com/${FB_GRAPH_VERSION}/me/accounts`,
      { params: { access_token: connection.access_token, fields: 'id,name,access_token' } }
    );
    const pages = Array.isArray(pagesResponse?.data?.data)
      ? pagesResponse.data.data
      : [];

    const selectedPages = pages.filter((p) => pageIds.includes(p.id));
    if (selectedPages.length === 0) {
      return res.status(400).json({ message: 'No matching pages found' });
    }

    await deleteFbPagesByCompanyId(company.id);

    const pageRows = selectedPages.map((p) => ({
      page_id: p.id,
      page_name: p.name,
      page_access_token: p.access_token,
      page_token_expires_at: null,
      is_subscribed: 0,
    }));

    await upsertFbPages(company.id, connection.fb_user_id, pageRows);

    const subscribedPageIds = [];
    for (const page of selectedPages) {
      try {
        await axios.post(
          `https://graph.facebook.com/${FB_GRAPH_VERSION}/${page.id}/subscribed_apps`,
          null,
          {
            params: {
              access_token: page.access_token,
              subscribed_fields: 'leadgen',
            },
          }
        );
        subscribedPageIds.push(page.id);
      } catch (err) {
        console.error(
          'Page subscription failed:',
          page.id,
          err?.response?.data || err.message
        );
      }
    }

    if (subscribedPageIds.length > 0) {
      await markPagesSubscribed(company.id, subscribedPageIds);
    }

    return res.status(200).json({
      message: 'Pages saved and subscribed',
      data: selectedPages.map((p) => ({
        id: p.id,
        name: p.name,
        subscribed: subscribedPageIds.includes(p.id),
      })),
    });
  } catch (error) {
    console.error('Error selecting Facebook pages:', error);
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  saveFbPages,
  getSavedFbPages,
  deleteSavedFbPages,
  deleteAllSavedFbPages,
  getAvailableFbPages,
  selectFbPages,
};
