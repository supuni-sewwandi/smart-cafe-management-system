const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ------------------------------------------------------------------
// GET /api/notifications   (US02.7 — Receive Notifications)
// ------------------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ error: 'Could not load notifications.' });
  }
});

// ------------------------------------------------------------------
// PATCH /api/notifications/:id/read   (mark one as read)
// ------------------------------------------------------------------
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    console.error('Update notification error:', err);
    res.status(500).json({ error: 'Could not update notification.' });
  }
});

// ------------------------------------------------------------------
// PATCH /api/notifications/read-all   (mark all as read)
// ------------------------------------------------------------------
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    res.status(500).json({ error: 'Could not update notifications.' });
  }
});

module.exports = router;
