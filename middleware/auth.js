const admin = require('../utils/admin');
const { getAdminByUID, getEmployeeByUID } = require('../models/userModel');
const { getCompanyByOwnerUid, getCompanyById } = require('../models/companyModel');


// ✅ 1. Verify Firebase Token
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.firebase_uid = decoded.uid;
    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    res.status(403).json({ error: 'Invalid token' });
  }
};

// ✅ 2. Super Admin Access
const requireSuperAdmin = async (req, res, next) => {
  const email = req.user?.email || '';
  const isSuperAdmin = process.env.SUPER_ADMIN_EMAIL === email;
  if (!isSuperAdmin) return res.status(403).json({ error: 'Access denied: Super Admin only' });
  next();
};

// ✅ 3. Basic Admin (no plan check)
const requireAdmin = async (req, res, next) => {
  const user = await getAdminByUID(req.firebase_uid);
  if (!user || user.status !== 'active') {
    return res.status(403).json({ error: 'Admin access denied' });
  }
  req.user = { ...user, role: 'admin' };
  next();
};

// ✅ 4. Admin + Active Company Plan
const requireAdminWithActiveCompany = async (req, res, next) => {
  const user = await getAdminByUID(req.firebase_uid);
  if (!user || user.status !== 'active') {
    return res.status(403).json({ error: 'Admin access denied' });
  }

  const company = await getCompanyByOwnerUid(req.firebase_uid);
  const isExpired = !company?.plan_expiry || new Date(company.plan_expiry) < new Date();

  if (!company || isExpired) {
    return res.status(403).json({ error: 'Company plan is inactive or expired' });
  }

  req.user = { ...user, role: 'admin' };
  req.company = company;
  next();
};

// ✅ 5. Employee + Active Company Plan
const requireEmployeeWithActiveCompany = async (req, res, next) => {
  const user = await getEmployeeByUID(req.firebase_uid);
  if (!user || user.status !== 'active') {
    return res.status(403).json({ error: 'Employee access denied' });
  }

  const company = await getCompanyById(user.company_id);
  const isExpired = !company?.plan_expiry || new Date(company.plan_expiry) < new Date();

  if (!company || isExpired) {
    return res.status(403).json({ error: 'Company plan is inactive or expired' });
  }

  req.user = { ...user, role: 'employee' };
  req.company = company;
  next();
};

module.exports = {
  verifyToken,
  requireSuperAdmin,
  requireAdmin,
  requireAdminWithActiveCompany,
  requireEmployeeWithActiveCompany,
};
