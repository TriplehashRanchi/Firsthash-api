const axios = require('axios');

const sendWhatsAppAccountActivated = async ({ name, company_name, phone }) => {
  try {
    const res = await axios.post(
      'https://backend.aisensy.com/campaign/t1/api/v2',
      {
        apiKey: process.env.AISENSY_API_KEY, // from .env
        campaignName: 'firsthash_welcome',
        destination: `91${phone}`,
        userName: name,
        source: 'FirstHash Payment',
        templateParams: [name, company_name],
        tags: ['firsthash_user'],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ WhatsApp sent via AiSensy:', res.data);
  } catch (err) {
    console.error('❌ WhatsApp send failed:', err?.response?.data || err.message);
  }
};

module.exports = { sendWhatsAppAccountActivated };
