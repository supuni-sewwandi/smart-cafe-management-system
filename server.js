require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const adminAuthRoutes = require('./routes/adminAuth');
const menuRoutes = require('./routes/menu');
const orderRoutes = require('./routes/orders');
const notificationRoutes = require('./routes/notifications');

const app = express();

app.use(cors());              // allows calling this API from a different origin, if ever needed
app.use(express.json());      // parses JSON request bodies

// Serve the front-end (index.html, menu.html, login.html, admin pages, etc.)
// from the public/ folder. Because the API and the HTML pages are now
// served by this SAME server, the front-end can call fetch('/api/...')
// with a relative path — no separate URL or CORS setup needed.
app.use(express.static(path.join(__dirname, 'public')));

// Health check — useful to confirm the server + .env are working
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Bean & Brew API is running.' });
});

// Customer auth: /api/auth/signup, /api/auth/login, /api/auth/me
app.use('/api/auth', authRoutes);

// Admin/staff auth: /api/admin/login, /api/admin/me, /api/admin/accounts, /api/admin/permissions
app.use('/api/admin', adminAuthRoutes);

// Menu items: /api/menu (public GET, admin POST/PUT/DELETE)
app.use('/api/menu', menuRoutes);

// Orders: /api/orders (customer create/view/cancel, admin manage)
app.use('/api/orders', orderRoutes);

// Notifications: /api/notifications
app.use('/api/notifications', notificationRoutes);

// Fallback 404 for anything else under /api
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Bean & Brew server running at http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT}/index.html in your browser.`);
});
