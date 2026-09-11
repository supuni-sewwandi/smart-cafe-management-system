const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function signAdminToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role, type: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ------------------------------------------------------------------
// POST /api/admin/login   (Admin / Staff login — separate from customers)
// body: { email, password }
// ------------------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const [rows] = await pool.query(
      'SELECT id, full_name, email, password_hash, role, status FROM admin_accounts WHERE email = ?',
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Incorrect admin email or password.' });
    }

    const admin = rows[0];
    if (admin.status !== 'active') {
      return res.status(403).json({ error: 'This account has been deactivated. Contact a System Administrator.' });
    }

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect admin email or password.' });
    }

    const token = signAdminToken(admin);
    res.json({
      token,
      admin: { id: admin.id, fullName: admin.full_name, email: admin.email, role: admin.role }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Something went wrong while logging in.' });
  }
});

// ------------------------------------------------------------------
// GET /api/admin/me   (returns the logged-in admin's own profile + permissions)
// ------------------------------------------------------------------
router.get('/me', requireAdmin, async (req, res) => {
  try {
    const [[admin]] = await pool.query(
      'SELECT id, full_name, email, role, status FROM admin_accounts WHERE id = ?',
      [req.user.id]
    );
    if (!admin) return res.status(404).json({ error: 'Account not found.' });

    const [permissionRows] = await pool.query(
      'SELECT module, allowed FROM role_permissions WHERE role = ?',
      [admin.role]
    );
    const permissions = {};
    permissionRows.forEach(p => { permissions[p.module] = !!p.allowed; });

    res.json({ ...admin, permissions });
  } catch (err) {
    console.error('Fetch admin profile error:', err);
    res.status(500).json({ error: 'Could not load account.' });
  }
});

// ------------------------------------------------------------------
// GET /api/admin/accounts   (US03.11 — Manage User Accounts, list all)
// Restricted to System Administrator role.
// ------------------------------------------------------------------
router.get('/accounts', requireAdmin, async (req, res) => {
  if (req.user.role !== 'System Administrator') {
    return res.status(403).json({ error: 'Only System Administrators can manage accounts.' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT id, full_name, email, role, status, created_at FROM admin_accounts ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('List accounts error:', err);
    res.status(500).json({ error: 'Could not load accounts.' });
  }
});

// ------------------------------------------------------------------
// POST /api/admin/accounts   (US03.11 — create a new staff/admin account)
// body: { fullName, email, password, role }
// ------------------------------------------------------------------
router.post('/accounts', requireAdmin, async (req, res) => {
  if (req.user.role !== 'System Administrator') {
    return res.status(403).json({ error: 'Only System Administrators can manage accounts.' });
  }
  try {
    const { fullName, email, password, role } = req.body;
    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ error: 'Full name, email, password and role are required.' });
    }

    const [existing] = await pool.query('SELECT id FROM admin_accounts WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO admin_accounts (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [fullName, email, passwordHash, role]
    );

    res.status(201).json({ id: result.insertId, fullName, email, role, status: 'active' });
  } catch (err) {
    console.error('Create account error:', err);
    res.status(500).json({ error: 'Could not create account.' });
  }
});

// ------------------------------------------------------------------
// PATCH /api/admin/accounts/:id/status   (activate / deactivate)
// body: { status: 'active' | 'inactive' }
// ------------------------------------------------------------------
router.patch('/accounts/:id/status', requireAdmin, async (req, res) => {
  if (req.user.role !== 'System Administrator') {
    return res.status(403).json({ error: 'Only System Administrators can manage accounts.' });
  }
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "active" or "inactive".' });
    }
    await pool.query('UPDATE admin_accounts SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Account status updated.' });
  } catch (err) {
    console.error('Update account status error:', err);
    res.status(500).json({ error: 'Could not update account status.' });
  }
});

// ------------------------------------------------------------------
// GET /api/admin/permissions   (US03.12 — full role/module matrix)
// ------------------------------------------------------------------
router.get('/permissions', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT role, module, allowed FROM role_permissions');
    res.json(rows);
  } catch (err) {
    console.error('Fetch permissions error:', err);
    res.status(500).json({ error: 'Could not load permissions.' });
  }
});

// ------------------------------------------------------------------
// PUT /api/admin/permissions   (US03.12 — update the matrix)
// body: { updates: [{ role, module, allowed }, ...] }
// ------------------------------------------------------------------
router.put('/permissions', requireAdmin, async (req, res) => {
  if (req.user.role !== 'System Administrator') {
    return res.status(403).json({ error: 'Only System Administrators can manage permissions.' });
  }
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: '"updates" must be an array.' });
    }

    for (const u of updates) {
      await pool.query(
        `INSERT INTO role_permissions (role, module, allowed) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE allowed = VALUES(allowed)`,
        [u.role, u.module, !!u.allowed]
      );
    }

    res.json({ message: 'Permissions updated.' });
  } catch (err) {
    console.error('Update permissions error:', err);
    res.status(500).json({ error: 'Could not update permissions.' });
  }
});

module.exports = router;
