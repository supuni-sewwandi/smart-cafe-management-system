require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const adminAuthRoutes = require('./routes/adminAuth');

const app = express();

app.use(cors());              // allows the HTML front-end (served from a different origin/file) to call this API
app.use(express.json());      // parses JSON request bodies

// Health check — useful to confirm the server + .env are working
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Bean & Brew API is running.' });
});

// Customer auth: /api/auth/signup, /api/auth/login, /api/auth/me
app.use('/api/auth', authRoutes);

// Admin/staff auth: /api/admin/login, /api/admin/me, /api/admin/accounts, /api/admin/permissions
app.use('/api/admin', adminAuthRoutes);

// Fallback 404 for anything else under /api
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Bean & Brew API listening on http://localhost:${PORT}`);
});
