const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./backend/routes/auth');
const projectRoutes = require('./backend/routes/projects');
const expenseRoutes = require('./backend/routes/expenses');
const paymentRoutes = require('./backend/routes/payments');
const userRoutes = require('./backend/routes/users');
const dashboardRoutes = require('./backend/routes/dashboard');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ShareIT API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

