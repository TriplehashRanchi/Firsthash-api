const deliverable2Model = require('../models/deliverable2Model');

exports.importBundleToDeliverable2 = async (req, res) => {
  try {
    const companyId = req.company.id;
    const projectId = req.params.id;
    const { bundle_id, deliverable_title = null, due_date = null } = req.body || {};

    if (!bundle_id) {
      return res.status(400).json({ error: 'bundle_id is required.' });
    }

    const result = await deliverable2Model.importBundleToDeliverable2({
      companyId,
      projectId,
      bundleId: bundle_id,
      deliverableTitle: deliverable_title,
      dueDate: due_date,
    });

    res.status(201).json({
      success: true,
      deliverable: result.deliverable2,
      created_count: result.createdCount,
    });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('inactive')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('title') || error.message.includes('hierarchy')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('❌ Failed to import bundle into deliverable_2:', error);
    res.status(500).json({ error: error.sqlMessage || 'Server error while importing task bundle.' });
  }
};

exports.updateDeliverable2DueDate = async (req, res) => {
  try {
    const companyId = req.company.id;
    const deliverable2Id = req.params.deliverable2Id;
    const { due_date = null } = req.body || {};

    const updated = await deliverable2Model.updateDeliverable2DueDate({
      companyId,
      deliverable2Id,
      dueDate: due_date,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Deliverable not found.' });
    }

    res.json(updated);
  } catch (error) {
    console.error('❌ Failed to update deliverable_2 due date:', error);
    res.status(500).json({ error: error.sqlMessage || 'Server error while updating due date.' });
  }
};
