const axios = require('axios');

const FB_GRAPH_VERSION = 'v16.0';

const getPages = async (accessToken) => {
  const response = await axios.get(
    `https://graph.facebook.com/me/accounts?access_token=${accessToken}`
  );
  const data = response.data;
  if (data?.error) {
    throw new Error(data.error.message);
  }
  return data.data;
};

const getForms = async (pageId, pageAccessToken) => {
  const response = await axios.get(
    `https://graph.facebook.com/${FB_GRAPH_VERSION}/${pageId}/leadgen_forms?access_token=${pageAccessToken}`
  );
  const data = response.data;
  if (data?.error) {
    throw new Error(data.error.message);
  }
  return data.data;
};

const getLeads = async (formId, pageAccessToken) => {
  const response = await axios.get(
    `https://graph.facebook.com/${FB_GRAPH_VERSION}/${formId}/leads?access_token=${pageAccessToken}`
  );
  const data = response.data;
  if (data?.error) {
    throw new Error(data.error.message);
  }
  return data.data;
};

module.exports = {
  getPages,
  getForms,
  getLeads,
};
