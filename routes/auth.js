const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, type: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ------------------------------------------------------------------
// POST /api/auth/signup   (US01.1 — Customer Registration)
// body: { fullName, email, password }
// ------------------------------------------------------------------
router.post('/signup', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Full name, email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)',
      [fullName, email, passwordHash]
    );

    const user = { id: result.insertId, email };
    const token = signToken(user);

    res.status(201).json({
      token,
      user: { id: user.id, fullName, email }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Something went wrong while creating your account.' });
  }
});

// ------------------------------------------------------------------
// POST /api/auth/login   (US01.2 — Customer Login)
// body: { email, password }
// ------------------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const [rows] = await pool.query(
      'SELECT id, full_name, email, password_hash FROM users WHERE email = ?',
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, fullName: user.full_name, email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong while logging in.' });
  }
});

// ------------------------------------------------------------------
// GET /api/auth/me   (returns the logged-in customer's profile)
// Requires: Authorization: Bearer <token>
// ------------------------------------------------------------------
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, full_name, email, phone, address, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Fetch profile error:', err);
    res.status(500).json({ error: 'Could not load profile.' });
  }
});

// ------------------------------------------------------------------
// PUT /api/auth/me   (US01.3 — Manage Customer Profile)
// body: { fullName, phone, address }
// ------------------------------------------------------------------
router.put('/me', requireAuth, async (req, res) => {
  try {
    const { fullName, phone, address } = req.body;
    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required.' });
    }

    await pool.query(
      'UPDATE users SET full_name = ?, phone = ?, address = ? WHERE id = ?',
      [fullName, phone || null, address || null, req.user.id]
    );

    res.json({ message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Could not update profile.' });
  }
});

module.exports = router;
