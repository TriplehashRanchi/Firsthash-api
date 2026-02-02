const taskBundleModel = require('../models/taskBundleModel');

exports.getBundles = async (req, res) => {
  try {
    const companyId = req.company.id;
    const bundles = await taskBundleModel.getBundlesByCompany(companyId);
    res.json(bundles);
  } catch (error) {
    console.error('❌ Failed to get task bundles:', error);
    res.status(500).json({ error: 'Server error while fetching task bundles.' });
  }
};

exports.createBundle = async (req, res) => {
  try {
    const companyId = req.company.id;
    const { name, description = null, is_active = 1 } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Bundle name is required.' });
    }

    const bundle = await taskBundleModel.createBundle(companyId, {
      name,
      description,
      is_active,
    });

    res.status(201).json(bundle);
  } catch (error) {
    console.error('❌ Failed to create task bundle:', error);
    res.status(500).json({ error: error.sqlMessage || 'Server error while creating task bundle.' });
  }
};

exports.updateBundle = async (req, res) => {
  try {
    const companyId = req.company.id;
    const bundleId = req.params.id;
    const payload = req.body || {};

    const updated = await taskBundleModel.updateBundle(bundleId, companyId, payload);
    if (!updated) {
      return res.status(404).json({ error: 'Bundle not found or no valid fields to update.' });
    }

    res.json(updated);
  } catch (error) {
    console.error('❌ Failed to update task bundle:', error);
    res.status(500).json({ error: error.sqlMessage || 'Server error while updating task bundle.' });
  }
};

exports.deleteBundle = async (req, res) => {
  try {
    const companyId = req.company.id;
    const bundleId = req.params.id;

    const deleted = await taskBundleModel.deleteBundle(bundleId, companyId);
    if (!deleted) {
      return res.status(404).json({ error: 'Bundle not found.' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('❌ Failed to delete task bundle:', error);
    res.status(500).json({ error: 'Server error while deleting task bundle.' });
  }
};

exports.getBundleItems = async (req, res) => {
  try {
    const companyId = req.company.id;
    const bundleId = req.params.id;

    const bundle = await taskBundleModel.getBundleById(bundleId, companyId);
    if (!bundle) return res.status(404).json({ error: 'Bundle not found.' });

    const items = await taskBundleModel.getBundleItems(bundleId, companyId);
    res.json(items);
  } catch (error) {
    console.error('❌ Failed to get bundle items:', error);
    res.status(500).json({ error: 'Server error while fetching bundle items.' });
  }
};

exports.addBundleItem = async (req, res) => {
  try {
    const companyId = req.company.id;
    const bundleId = req.params.id;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Item title is required.' });
    }

    const item = await taskBundleModel.addBundleItem(bundleId, companyId, req.body);
    if (!item) return res.status(404).json({ error: 'Bundle not found.' });

    res.status(201).json(item);
  } catch (error) {
    if (error.message.includes('Parent item')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('❌ Failed to add bundle item:', error);
    res.status(500).json({ error: error.sqlMessage || 'Server error while adding bundle item.' });
  }
};

exports.updateBundleItem = async (req, res) => {
  try {
    const companyId = req.company.id;
    const bundleId = req.params.id;
    const itemId = req.params.itemId;

    const item = await taskBundleModel.updateBundleItem(bundleId, itemId, companyId, req.body || {});
    if (!item) {
      return res.status(404).json({ error: 'Bundle or item not found, or no valid fields provided.' });
    }

    res.json(item);
  } catch (error) {
    if (error.message.includes('Parent item') || error.message.includes('cannot be parent')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('❌ Failed to update bundle item:', error);
    res.status(500).json({ error: error.sqlMessage || 'Server error while updating bundle item.' });
  }
};

exports.deleteBundleItem = async (req, res) => {
  try {
    const companyId = req.company.id;
    const bundleId = req.params.id;
    const itemId = req.params.itemId;

    const deleted = await taskBundleModel.deleteBundleItem(bundleId, itemId, companyId);
    if (!deleted) return res.status(404).json({ error: 'Bundle item not found.' });

    res.status(204).send();
  } catch (error) {
    console.error('❌ Failed to delete bundle item:', error);
    res.status(500).json({ error: 'Server error while deleting bundle item.' });
  }
};

exports.importBundleToDeliverable = async (req, res) => {
  try {
    const companyId = req.company.id;
    const deliverableId = req.params.deliverableId;
    const { bundle_id, due_base_date = null, skip_duplicates = true } = req.body;

    if (!bundle_id) {
      return res.status(400).json({ error: 'bundle_id is required.' });
    }

    const result = await taskBundleModel.importBundleToDeliverable({
      companyId,
      deliverableId,
      bundleId: bundle_id,
      dueBaseDate: due_base_date,
      skipDuplicates: skip_duplicates !== false,
    });

    res.status(201).json({
      success: true,
      message: 'Bundle imported successfully.',
      created_count: result.createdCount,
      skipped_count: result.skippedCount,
    });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('inactive')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('hierarchy')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('❌ Failed to import bundle into deliverable:', error);
    res.status(500).json({ error: error.sqlMessage || 'Server error while importing task bundle.' });
  }
};
