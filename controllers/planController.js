const {
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
} = require('../models/planModel');

const getPlans = async (req, res) => {
  try {
    const plans = await getAllPlans();
    res.json(plans);
  } catch (err) {
    console.error('Get plans failed:', err);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
};

const getPlan = async (req, res) => {
  try {
    const plan = await getPlanById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
};

const postPlan = async (req, res) => {
  try {
    await createPlan(req.body);
    res.status(201).json({ message: 'Plan created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create plan' });
  }
};

const putPlan = async (req, res) => {
  try {
    await updatePlan(req.params.id, req.body);
    res.json({ message: 'Plan updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update plan' });
  }
};

const removePlan = async (req, res) => {
  try {
    await deletePlan(req.params.id);
    res.json({ message: 'Plan deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete plan' });
  }
};

module.exports = { getPlans, getPlan, postPlan, putPlan, removePlan };
