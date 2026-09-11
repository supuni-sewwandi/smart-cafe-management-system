const express = require('express');
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ------------------------------------------------------------------
// GET /api/menu   (US01.4 — View Digital Menu)
// Public — no login needed to browse the menu.
// Optional query: ?category=coffee|cold|food
// ------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT id, name, category, price, description, photo_url, badge, rating FROM menu_items WHERE is_active = TRUE';
    const params = [];

    if (category && ['coffee', 'cold', 'food'].includes(category)) {
      sql += ' AND category = ?';
      params.push(category);
    }
    sql += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Fetch menu error:', err);
    res.status(500).json({ error: 'Could not load the menu.' });
  }
});

// ------------------------------------------------------------------
// GET /api/menu/:id   (single item — used for edit forms)
// ------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Item not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Fetch menu item error:', err);
    res.status(500).json({ error: 'Could not load this item.' });
  }
});

// ------------------------------------------------------------------
// POST /api/menu   (admin — add a new menu item; menu-items.html)
// body: { name, category, price, description, photoUrl, badge, rating }
// ------------------------------------------------------------------
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, category, price, description, photoUrl, badge, rating } = req.body;
    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Name, category and price are required.' });
    }
    if (!['coffee', 'cold', 'food'].includes(category)) {
      return res.status(400).json({ error: 'Category must be coffee, cold, or food.' });
    }

    const [result] = await pool.query(
      `INSERT INTO menu_items (name, category, price, description, photo_url, badge, rating)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, category, price, description || null, photoUrl || null, badge || null, rating || 4.5]
    );

    res.status(201).json({ id: result.insertId, message: 'Menu item added.' });
  } catch (err) {
    console.error('Create menu item error:', err);
    res.status(500).json({ error: 'Could not add the menu item.' });
  }
});

// ------------------------------------------------------------------
// PUT /api/menu/:id   (admin — edit an existing item)
// ------------------------------------------------------------------
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, category, price, description, photoUrl, badge, rating } = req.body;
    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Name, category and price are required.' });
    }

    const [result] = await pool.query(
      `UPDATE menu_items
       SET name = ?, category = ?, price = ?, description = ?, photo_url = ?, badge = ?, rating = ?
       WHERE id = ?`,
      [name, category, price, description || null, photoUrl || null, badge || null, rating || 4.5, req.params.id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Item not found.' });
    res.json({ message: 'Menu item updated.' });
  } catch (err) {
    console.error('Update menu item error:', err);
    res.status(500).json({ error: 'Could not update the menu item.' });
  }
});

// ------------------------------------------------------------------
// DELETE /api/menu/:id   (admin — remove an item from the menu)
// We soft-delete (is_active = FALSE) so past orders that reference this
// item keep working — the item just stops appearing to customers.
// ------------------------------------------------------------------
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [result] = await pool.query('UPDATE menu_items SET is_active = FALSE WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Item not found.' });
    res.json({ message: 'Menu item removed.' });
  } catch (err) {
    console.error('Delete menu item error:', err);
    res.status(500).json({ error: 'Could not remove the menu item.' });
  }
});

module.exports = router;
