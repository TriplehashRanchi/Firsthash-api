const express = require('express');
const cors = require('cors');
const morgan = require('morgan'); // ✅ Import
const path = require('path'); // <-- Make sure you have the 'path' module imported

// ... your route imports (projectRoutes, taskRoutes, etc.)
const uploadRoutes = require('./routes/uploadRoutes'); // <-- ADD THIS NEW ROUTE IMPORT
const authRoutes = require('./routes/authRoutes');
const subscribeRoutes = require('./routes/subscribeRoutes');
const companyRoutes = require('./routes/companyRoutes');
const planRoutes = require('./routes/planRoutes');
const couponRoutes = require('./routes/couponRoutes');
const superadminRoutes = require('./routes/superadminRoutes');
const roleRoutes = require('./routes/rolesRoutes');
const memberRoutes = require('./routes/memberRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const clientRoutes = require('./routes/clientRoutes');
const eventRoutes = require('./routes/eventRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const deliverableRoutes = require('./routes/deliverableRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const shootRoutes = require('./routes/shootRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const adminRoutes = require('./routes/adminRoutes');
const quotationRoutes = require('./routes/quotationRoutes'); // <-- ADD THIS IMPORT


const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev')); // ✅ Use in dev mode

app.use('/api/auth', authRoutes);
app.use('/api/subscribe', subscribeRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/deliverables', deliverableRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/shoots', shootRoutes);
app.use('/api/projects/:projectId/expenses', expenseRoutes);
app.use('/api/projects/:projectId/quotations', quotationRoutes);

const uploadsBasePath = process.env.NODE_ENV === 'production' 
    ? '/usr/src/app/uploads' 
    : path.join(process.cwd(), 'uploads');

app.use('/uploads', express.static(uploadsBasePath));


// 2. API Route Registration
// This line tells Express: "Any request to a URL starting with '/api/uploads'
// should be handled by the logic inside the uploadRoutes file."
app.use('/api/uploads', uploadRoutes);
app.use('/api/admins', adminRoutes);



module.exports = app;
