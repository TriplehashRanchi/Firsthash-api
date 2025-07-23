const express = require('express');
const cors = require('cors');
const morgan = require('morgan'); // ✅ Import
const authRoutes = require('./routes/authRoutes');
const subscribeRoutes = require('./routes/subscribeRoutes');
const companyRoutes = require('./routes/companyRoutes');
const planRoutes = require('./routes/planRoutes');
const couponRoutes = require('./routes/couponRoutes');
const superadminRoutes = require('./routes/superadminRoutes');
const roleRoutes = require('./routes/rolesRoutes');
const memberRoutes = require('./routes/memberRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');

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



module.exports = app;
