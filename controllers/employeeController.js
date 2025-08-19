// backend/controllers/employeeController.js
const model = require('../models/employeeModel');

exports.getMyTasks = async (req, res) => {
  try {
    const company_id = req.company?.id || req.user?.company_id;
    const uid = req.user?.firebase_uid || req.firebase_uid;

    if (!company_id || !uid) {
      return res.status(403).json({ error: 'Authentication context missing.' });
    }

    const tasks = await model.getTasksAssignedToUser(company_id, uid);
    return res.json(tasks);
  } catch (err) {
    console.error('❌ getMyTasks error:', err);
    return res.status(500).json({ error: 'Server error while fetching tasks.' });
  }
};

exports.getMyProjects = async (req, res) => {
  try {
    const company_id = req.company?.id || req.user?.company_id;
    const uid = req.user?.firebase_uid || req.firebase_uid;

    if (!company_id || !uid) {
      return res.status(403).json({ error: 'Authentication context missing.' });
    }

    const projects = await model.getProjectsAssignedToUser(company_id, uid);
    return res.json(projects);
  } catch (err) {
    console.error('❌ getMyProjects error:', err);
    return res.status(500).json({ error: 'Server error while fetching projects.' });
  }
};

exports.viewProjectById = async (req, res) => {
  try {
    const company_id = req.company?.id || req.user?.company_id;
    const uid = req.user?.firebase_uid || req.firebase_uid;
    const projectId = req.params.id;

    if (!projectId) return res.status(400).json({ error: 'Missing project id.' });
    if (!company_id || !uid) return res.status(403).json({ error: 'Authentication context missing.' });

    const allowed = await model.isEmployeeAssignedToProject(company_id, projectId, uid);
    if (!allowed) return res.status(403).json({ error: 'Not allowed to view this project.' });

    const data = await model.getProjectDetailsView(company_id, projectId);
    if (!data) return res.status(404).json({ error: 'Project not found.' });

    return res.json(data);
  } catch (err) {
    console.error('❌ viewProjectById error:', err);
    return res.status(500).json({ error: 'An error occurred while fetching project details.' });
  }
};


exports.getMySalaryHistory = async (req, res) => {
    try {
        const uid = req.user.firebase_uid;
        const company_id = req.company.id;
        if (!uid || !company_id) return res.status(403).json({ error: 'Auth context missing.' });

        console.log('IN GET MY SALARY HISTORY, REQ.USER:', req.user);
        
        const data = await model.fetchSalaryHistory(company_id, uid);
        res.json(data);
    } catch (err) {
        console.error('Error in getMySalaryHistory:', err);
        res.status(500).json({ error: 'Failed to load salary history.' });
    }
};

exports.getMySalarySummary = async (req, res) => {
    try {
        const uid = req.user.firebase_uid;
        const company_id = req.company.id;
        if (!uid || !company_id) return res.status(403).json({ error: 'Auth context missing.' });

        const data = await model.fetchSalarySummary(company_id, uid);
        res.json(data);
    } catch (err) {
        console.error('Error in getMySalarySummary:', err);
        res.status(500).json({ error: 'Failed to load salary summary.' });
    }
};

exports.getMyExpenses = async (req, res) => {
    try {
        const uid = req.user.firebase_uid;
        const company_id = req.company.id;
        if (!uid || !company_id) return res.status(403).json({ error: 'Auth context missing.' });

        const data = await model.fetchExpenses(company_id, uid);
        res.json(data);
    } catch (err) {
        console.error('Error in getMyExpenses:', err);
        res.status(500).json({ error: 'Failed to load expenses.' });
    }
};