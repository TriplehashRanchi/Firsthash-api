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


// ✅ 6. Manager + Active Company Plan
const requireManagerWithActiveCompany = async (req, res, next) => {
  const user = await getEmployeeByUID(req.firebase_uid);
  if (!user || user.status !== 'active') {
    return res.status(403).json({ error: 'Manager access denied: inactive user' });
  }

  // Check company validity
  const company = await getCompanyById(user.company_id);
  const isExpired = !company?.plan_expiry || new Date(company.plan_expiry) < new Date();

  if (!company || isExpired) {
    return res.status(403).json({ error: 'Manager access denied: company plan expired' });
  }

  // Must be employee_type = 2 → Manager
  if (user.employee_type !== 2) {
    return res.status(403).json({ error: 'Manager access denied: not a manager' });
  }

  req.user = { ...user, role: 'manager' };
  req.company = company;
  next();
};

const requireAdminOrManagerWithActiveCompany = async (req, res, next) => {
  const admin = await getAdminByUID(req.firebase_uid);
  if (admin && admin.status === 'active') {
    const company = await getCompanyByOwnerUid(req.firebase_uid);
    if (company && new Date(company.plan_expiry) > new Date()) {
      req.user = { ...admin, role: 'admin' };
      req.company = company;
      return next();
    }
  }

  const employee = await getEmployeeByUID(req.firebase_uid);
  if (employee && employee.status === 'active' && employee.employee_type === 2) {
    const company = await getCompanyById(employee.company_id);
    if (company && new Date(company.plan_expiry) > new Date()) {
      req.user = { ...employee, role: 'manager' };
      req.company = company;
      return next();
    }
  }

  return res.status(403).json({ error: 'Access denied: must be admin or manager with active plan' });
};


module.exports = {
  verifyToken,
  requireSuperAdmin,
  requireAdmin,
  requireAdminWithActiveCompany,
  requireEmployeeWithActiveCompany,
  requireManagerWithActiveCompany,
  requireAdminOrManagerWithActiveCompany
};
