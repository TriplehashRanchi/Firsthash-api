const express = require('express');
const router = express.Router();
const fbDataController = require('../controllers/fbDataController');

router.get('/pages', async (req, res) => {
  try {
    const { accessToken } = req.query;
    if (!accessToken) {
      return res
        .status(400)
        .json({ error: 'accessToken query parameter is required' });
    }
    const pages = await fbDataController.getPages(accessToken);
    return res.json(pages);
  } catch (error) {
    console.error('Error fetching pages:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/forms/:pageId', async (req, res) => {
  try {
    const { pageId } = req.params;
    const { accessToken } = req.query;
    if (!accessToken) {
      return res
        .status(400)
        .json({ error: 'accessToken query parameter is required' });
    }
    const forms = await fbDataController.getForms(pageId, accessToken);
    return res.json(forms);
  } catch (error) {
    console.error('Error fetching forms:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/leads/:formId', async (req, res) => {
  try {
    const { formId } = req.params;
    const { accessToken } = req.query;
    if (!accessToken) {
      return res
        .status(400)
        .json({ error: 'accessToken query parameter is required' });
    }
    const leads = await fbDataController.getLeads(formId, accessToken);
    return res.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
