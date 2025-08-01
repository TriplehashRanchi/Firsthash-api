const deliverableTemplates = require('../models/deliverableTemplateModel');
const deliverableBundles = require('../models/deliverableBundleModel');

// ---------- Templates (Single Deliverables) ----------

// GET /api/deliverables/templates?company_id=123
exports.getTemplates = async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Missing company_id' });

    const templates = await deliverableTemplates.getAllDeliverableTemplates(company_id);
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
};

// POST /api/deliverables/templates
// Body: { company_id, title }
exports.addTemplate = async (req, res) => {
  try {
    const { company_id, title } = req.body;
    if (!company_id || !title) return res.status(400).json({ error: 'Missing fields' });

    await deliverableTemplates.addDeliverableTemplate(company_id, title);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add template' });
  }
};

// DELETE /api/deliverables/templates
// Body: { id }
exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    await deliverableTemplates.deleteDeliverableTemplate(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
};


exports.getBundles = async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) {
      return res.status(400).json({ error: 'Missing company_id' });
    }

    const bundlesWithItems = await deliverableBundles.getDeliverableBundles(company_id);
    res.status(200).json(bundlesWithItems);

  } catch (err) {
    // This will now only catch true unexpected errors, like the database being down.
    console.error("Error in getBundles controller:", err); // Log the error for debugging
    res.status(500).json({ error: 'An internal server error occurred while fetching bundles.' });
  }
};

// POST /api/deliverables/bundles
// Body: { company_id, name, items: [ 'Item 1', 'Item 2', ... ] }
exports.addBundle = async (req, res) => {
  try {
    const { company_id, bundle_name, items } = req.body;
    if (!company_id || !bundle_name || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Missing fields or invalid items' });
    }
    console.log(req.body);

    const id = await deliverableBundles.addDeliverableBundle(company_id, bundle_name, items);
    res.json({ success: true, bundle_id: id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add bundle' });
  }
};

// DELETE /api/deliverables/bundles
// Body: { id }
exports.deleteBundle = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing bundle id' });

    await deliverableBundles.deleteDeliverableBundle(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete bundle' });
  }
};


// Add this new function to handle PUT requests
exports.updateBundle = async (req, res) => {
  try {
    const { company_id, bundle_id, items } = req.body;
    if (!company_id || !bundle_id || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Missing fields or invalid items' });
    }

    await deliverableBundles.updateDeliverableBundle(bundle_id, company_id, items);
    res.status(200).json({ success: true, message: 'Bundle updated successfully' });

  } catch (err) {
    console.error("Error in updateBundle controller:", err);
    res.status(500).json({ error: 'Failed to update bundle' });
  }
};