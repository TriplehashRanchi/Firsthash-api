const axios = require('axios');
const { upsertFbConnection } = require('../models/fbAuthModel');
const {
  getCompanyByOwnerUid,
  getCompanyByEmployeeUid,
} = require('../models/companyModel');

const FB_GRAPH_VERSION = 'v16.0';

class FbAuthController {
  static getRedirectUri(req) {
    return (
      process.env.FB_REDIRECT_URI ||
      `${req.protocol}://${req.get('host')}/auth/facebook/callback`
    );
  }

  static async getCompanyForUser(firebase_uid) {
    const company =
      (await getCompanyByOwnerUid(firebase_uid)) ||
      (await getCompanyByEmployeeUid(firebase_uid));
    return company || null;
  }

  static async facebookInit(req, res) {
    try {
      const clientId = process.env.FB_APP_ID;
      const redirectUri = FbAuthController.getRedirectUri(req);

      if (!clientId) {
        return res.status(500).json({ message: 'FB_APP_ID not configured' });
      }

      const company = await FbAuthController.getCompanyForUser(req.firebase_uid);
      if (!company) {
        return res.status(400).json({ message: 'Company not found' });
      }

      const scope = [
        'pages_show_list',
        'pages_read_engagement',
        'leads_retrieval',
        'pages_manage_metadata',
        'pages_manage_ads',
        'business_management',
      ].join(',');

      const statePayload = {
        firebase_uid: req.firebase_uid,
        company_id: company.id,
      };
      const state = encodeURIComponent(JSON.stringify(statePayload));

      const facebookOAuthURL =
        `https://www.facebook.com/${FB_GRAPH_VERSION}/dialog/oauth` +
        `?client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&response_type=code` +
        `&state=${state}`;

      return res.json({ redirectUrl: facebookOAuthURL });
    } catch (error) {
      console.error('facebookInit error:', error);
      return res.status(500).send('Error initiating Facebook OAuth.');
    }
  }

  static async facebookLogin(req, res) {
    try {
      const clientId = process.env.FB_APP_ID;
      const redirectUri = FbAuthController.getRedirectUri(req);

      if (!clientId) {
        return res.status(500).send('FB_APP_ID not configured');
      }

      const company = await FbAuthController.getCompanyForUser(req.firebase_uid);
      if (!company) {
        return res.status(400).json({ message: 'Company not found' });
      }

      const scope = [
        'pages_show_list',
        'pages_read_engagement',
        'leads_retrieval',
        'pages_manage_metadata',
        'pages_manage_ads',
        'business_management',
      ].join(',');

      const statePayload = {
        firebase_uid: req.firebase_uid,
        company_id: company.id,
      };
      const state = encodeURIComponent(JSON.stringify(statePayload));

      const facebookOAuthURL =
        `https://www.facebook.com/${FB_GRAPH_VERSION}/dialog/oauth` +
        `?client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&response_type=code` +
        `&state=${state}`;

      return res.redirect(facebookOAuthURL);
    } catch (error) {
      console.error('facebookLogin error:', error);
      return res.status(500).send('Error initiating Facebook OAuth.');
    }
  }

  static async facebookCallback(req, res) {
    try {
      const { code, state } = req.query;

      if (!code) return res.status(400).send('No code returned from Facebook');
      if (!state) return res.status(400).send('State parameter missing');

      let adminFirebaseUid;
      let companyId;
      try {
        const parsedState = JSON.parse(decodeURIComponent(state));
        adminFirebaseUid = parsedState.firebase_uid;
        companyId = parsedState.company_id;
      } catch (err) {
        console.error('Failed to parse state param:', err);
        return res.status(400).send('Invalid state param');
      }

      if (!adminFirebaseUid || !companyId) {
        return res.status(400).send('Missing state data');
      }

      const clientId = process.env.FB_APP_ID;
      const clientSecret = process.env.FB_APP_SECRET;
      const redirectUri = FbAuthController.getRedirectUri(req);

      if (!clientId || !clientSecret) {
        return res.status(500).send('Facebook app credentials not configured');
      }

      const tokenURL = `https://graph.facebook.com/${FB_GRAPH_VERSION}/oauth/access_token`;
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      });

      const tokenResponse = await axios.get(`${tokenURL}?${params.toString()}`);
      const tokenData = tokenResponse.data;

      if (tokenData?.error) {
        console.error('Error exchanging code for token:', tokenData.error);
        return res.status(500).send('Failed to exchange code for an access token');
      }

      const shortLivedToken = tokenData.access_token;

      const longLivedURL =
        `https://graph.facebook.com/${FB_GRAPH_VERSION}/oauth/access_token` +
        `?grant_type=fb_exchange_token` +
        `&client_id=${clientId}` +
        `&client_secret=${clientSecret}` +
        `&fb_exchange_token=${shortLivedToken}`;

      const longResponse = await axios.get(longLivedURL);
      const llData = longResponse.data;

      if (llData?.error) {
        console.error('Error getting long-lived token:', llData.error);
        return res.status(500).send('Failed to get long-lived token');
      }

      const longLivedToken = llData.access_token;
      const fbTokenExpiry = llData.expires_in
        ? new Date(Date.now() + llData.expires_in * 1000)
        : null;

      const meResponse = await axios.get(
        `https://graph.facebook.com/${FB_GRAPH_VERSION}/me`,
        { params: { fields: 'id,name', access_token: longLivedToken } }
      );
      const fbUserId = meResponse?.data?.id;
      const fbUserName = meResponse?.data?.name || null;

      if (!fbUserId) {
        return res.status(500).send('Failed to fetch Facebook user profile');
      }

      await upsertFbConnection({
        company_id: companyId,
        admin_firebase_uid: adminFirebaseUid,
        fb_user_id: fbUserId,
        fb_user_name: fbUserName,
        access_token: longLivedToken,
        token_expires_at: fbTokenExpiry,
      });

      const redirectSuccess =
        process.env.FB_SUCCESS_REDIRECT ||
        `${process.env.FRONTEND_URL || 'https://app.digitalgyanisaarthi.com'}/facebook-leads?connected=true`;
      return res.redirect(redirectSuccess);
    } catch (error) {
      const responseData = error?.response?.data;
      if (responseData) {
        console.error('facebookCallback error response:', responseData);
      }
      console.error('facebookCallback error:', error);
      return res
        .status(500)
        .send('OAuth callback error. Check server logs for details.');
    }
  }
}

module.exports = FbAuthController;
