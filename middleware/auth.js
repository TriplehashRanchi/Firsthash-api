const admin = require('../utils/admin');
const { getAdminByUID, getEmployeeByUID } = require('../models/userModel');
const { getCompanyByOwnerUid, getCompanyById } = require('../models/companyModel');

// 1) Verify Firebase Token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const decoded = await admin.auth().verifyIdToken(token);
    req.firebase_uid = decoded.uid;
    req.firebase_email = decoded.email || null; // useful downstream
    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    res.status(403).json({ error: 'Invalid token' });
  }
};

// 2) Super Admin Access
const requireSuperAdmin = async (req, res, next) => {
  try {
    // use email from verified token or previously set req.user
    const email = req.firebase_email || req.user?.email || '';
    const isSuperAdmin = process.env.SUPER_ADMIN_EMAIL === email;
    if (!isSuperAdmin) return res.status(403).json({ error: 'Access denied: Super Admin only' });
    next();
  } catch (err) {
    console.error('requireSuperAdmin error:', err);
    res.status(500).json({ error: 'Internal error in super admin check' });
  }
};

// 3) Basic Admin (no plan check)
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.firebase_uid) return res.status(401).json({ error: 'Unauthorized' });

    const user = await getAdminByUID(req.firebase_uid);
    if (!user || user.status !== 'active') {
      return res.status(403).json({ error: 'Admin access denied' });
    }

    req.user = { ...user, role: 'admin' };
    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    res.status(500).json({ error: 'Internal error in admin check' });
  }
};

// 4) Admin + Active Company Plan
const requireAdminWithActiveCompany = async (req, res, next) => {
  try {
    if (!req.firebase_uid) return res.status(401).json({ error: 'Unauthorized' });

    const user = await getAdminByUID(req.firebase_uid);
    if (!user || user.status !== 'active') {
      return res.status(403).json({ error: 'Admin access denied' });
    }

    // Guard: company lookup may fail or return null
    let company = null;
    try {
      company = await getCompanyByOwnerUid(req.firebase_uid);
    } catch (e) {
      console.error('getCompanyByOwnerUid error:', e);
    }

    const planExpiry = company?.plan_expiry ? new Date(company.plan_expiry) : null;
    const isExpired = !planExpiry || Number.isNaN(planExpiry.getTime()) || planExpiry < new Date();

    if (!company || isExpired) {
      return res.status(403).json({ error: 'Company plan is inactive or expired' });
    }

    req.user = { ...user, role: 'admin' };
    req.company = company;
    next();
  } catch (err) {
    console.error('requireAdminWithActiveCompany error:', err);
    res.status(500).json({ error: 'Internal error in company plan check' });
  }
};

// 5) Employee + Active Company Plan
const requireEmployeeWithActiveCompany = async (req, res, next) => {
  try {
    if (!req.firebase_uid) return res.status(401).json({ error: 'Unauthorized' });

    const user = await getEmployeeByUID(req.firebase_uid);
    if (!user || user.status !== 'active') {
      return res.status(403).json({ error: 'Employee access denied' });
    }

    let company = null;
    try {
      company = await getCompanyById(user.company_id);
    } catch (e) {
      console.error('getCompanyById error:', e);
    }

    const planExpiry = company?.plan_expiry ? new Date(company.plan_expiry) : null;
    const isExpired = !planExpiry || Number.isNaN(planExpiry.getTime()) || planExpiry < new Date();

    if (!company || isExpired) {
      return res.status(403).json({ error: 'Company plan is inactive or expired' });
    }

    req.user = { ...user, role: 'employee' };
    req.company = company;
    next();
  } catch (err) {
    console.error('requireEmployeeWithActiveCompany error:', err);
    res.status(500).json({ error: 'Internal error in employee/company check' });
  }
};

module.exports = {
  verifyToken,
  requireSuperAdmin,
  requireAdmin,
  requireAdminWithActiveCompany,
  requireEmployeeWithActiveCompany,
};
