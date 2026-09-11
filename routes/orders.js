const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const DELIVERY_FEE = 200;

async function addNotification(userId, message) {
  await pool.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [userId, message]);
}

// ------------------------------------------------------------------
// POST /api/orders   (US01.5, US01.6, US01.7, US02.5 — place an order)
// Requires customer login.
// body: {
//   items: [{ menuItemId, qty }],
//   orderType: 'pickup' | 'delivery',
//   address: string (required if delivery),
//   paymentMethod: 'cash' | 'card'
// }
// Prices are looked up from the database (not trusted from the client)
// so someone can't submit a fake cheaper price from the browser.
// ------------------------------------------------------------------
router.post('/', requireAuth, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { items, orderType, address, paymentMethod } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty.' });
    }
    if (!['pickup', 'delivery'].includes(orderType)) {
      return res.status(400).json({ error: 'Order type must be pickup or delivery.' });
    }
    if (orderType === 'delivery' && !address) {
      return res.status(400).json({ error: 'Please provide a delivery address.' });
    }
    if (!['cash', 'card'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Payment method must be cash or card.' });
    }

    // Look up each item's real price/name from the database
    const menuItemIds = items.map(i => i.menuItemId);
    const [menuRows] = await connection.query(
      `SELECT id, name, price FROM menu_items WHERE id IN (${menuItemIds.map(() => '?').join(',')}) AND is_active = TRUE`,
      menuItemIds
    );
    if (menuRows.length !== items.length) {
      return res.status(400).json({ error: 'One or more items in your cart are no longer available.' });
    }

    const priceMap = {};
    menuRows.forEach(m => { priceMap[m.id] = m; });

    let subtotal = 0;
    const orderLines = items.map(i => {
      const menuItem = priceMap[i.menuItemId];
      const qty = Math.max(1, parseInt(i.qty, 10) || 1);
      subtotal += Number(menuItem.price) * qty;
      return { menuItemId: menuItem.id, name: menuItem.name, price: menuItem.price, qty };
    });

    const deliveryFee = orderType === 'delivery' ? DELIVERY_FEE : 0;
    const total = subtotal + deliveryFee;

    await connection.beginTransaction();

    const [orderResult] = await connection.query(
      `INSERT INTO orders (user_id, order_type, address, payment_method, subtotal, delivery_fee, total, status, refund_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'new', 'none')`,
      [req.user.id, orderType, orderType === 'delivery' ? address : null, paymentMethod, subtotal, deliveryFee, total]
    );
    const orderId = orderResult.insertId;

    for (const line of orderLines) {
      await connection.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, price, qty) VALUES (?, ?, ?, ?, ?)`,
        [orderId, line.menuItemId, line.name, line.price, line.qty]
      );
    }

    await connection.commit();
    await addNotification(req.user.id, `Order #${orderId} has been confirmed and is being prepared.`);

    res.status(201).json({ id: orderId, total, status: 'new', message: 'Order placed successfully.' });
  } catch (err) {
    await connection.rollback();
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Could not place your order.' });
  } finally {
    connection.release();
  }
});

// ------------------------------------------------------------------
// GET /api/orders   (US01.8 — View Order History)
// Returns the logged-in customer's own orders, most recent first,
// each with its line items attached.
// ------------------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  try {
    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    if (orders.length === 0) return res.json([]);

    const orderIds = orders.map(o => o.id);
    const [items] = await pool.query(
      `SELECT * FROM order_items WHERE order_id IN (${orderIds.map(() => '?').join(',')})`,
      orderIds
    );

    const result = orders.map(o => ({
      ...o,
      items: items.filter(i => i.order_id === o.id)
    }));
    res.json(result);
  } catch (err) {
    console.error('Fetch orders error:', err);
    res.status(500).json({ error: 'Could not load your orders.' });
  }
});

// ------------------------------------------------------------------
// GET /api/orders/:id   (single order — for order-tracking.html / invoice.html)
// A customer can only view their own order; an admin can view any order.
// ------------------------------------------------------------------
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    if (req.user.type !== 'admin' && order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have access to this order.' });
    }

    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    res.json({ ...order, items });
  } catch (err) {
    console.error('Fetch order error:', err);
    res.status(500).json({ error: 'Could not load this order.' });
  }
});

// ------------------------------------------------------------------
// PATCH /api/orders/:id/cancel   (US02.6 — Cancel Order/Request Refund)
// Customer-only, and only while the order is still "new".
// ------------------------------------------------------------------
router.patch('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have access to this order.' });
    }
    if (order.status !== 'new') {
      return res.status(400).json({ error: 'This order can no longer be cancelled.' });
    }

    await pool.query(
      `UPDATE orders SET status = 'cancelled', refund_status = 'requested' WHERE id = ?`,
      [order.id]
    );
    await addNotification(req.user.id, `Order #${order.id} was cancelled. Your refund has been requested.`);

    res.json({ message: 'Order cancelled and refund requested.' });
  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(500).json({ error: 'Could not cancel this order.' });
  }
});

// ==================================================================
// STAFF / ADMIN ROUTES  (US02.8-02.12, US03.8 — staff-orders.html)
// ==================================================================

// ------------------------------------------------------------------
// GET /api/orders/admin/all   (US02.12 — View Active Orders, all customers)
// Optional query: ?status=new|prep|ready|completed|cancelled
// ------------------------------------------------------------------
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT o.*, u.email AS customer_email, u.full_name AS customer_name
      FROM orders o
      JOIN users u ON u.id = o.user_id`;
    const params = [];
    if (status) {
      sql += ' WHERE o.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY o.created_at DESC';

    const [orders] = await pool.query(sql, params);
    if (orders.length === 0) return res.json([]);

    const orderIds = orders.map(o => o.id);
    const [items] = await pool.query(
      `SELECT * FROM order_items WHERE order_id IN (${orderIds.map(() => '?').join(',')})`,
      orderIds
    );
    const result = orders.map(o => ({ ...o, items: items.filter(i => i.order_id === o.id) }));
    res.json(result);
  } catch (err) {
    console.error('Fetch all orders error:', err);
    res.status(500).json({ error: 'Could not load orders.' });
  }
});

// ------------------------------------------------------------------
// PATCH /api/orders/:id/status   (US02.11 — Update Order Status)
// body: { status: 'prep' | 'ready' | 'completed' }
// ------------------------------------------------------------------
router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['prep', 'ready', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Status must be prep, ready, or completed.' });
    }

    const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, order.id]);

    const label = status === 'prep' ? 'being prepared' : status;
    await addNotification(order.user_id, `Your order #${order.id} is now ${label}.`);

    res.json({ message: 'Order status updated.' });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Could not update order status.' });
  }
});

// ------------------------------------------------------------------
// PATCH /api/orders/:id/refund   (US02.10 — Manage Refunds, cashier processes it)
// ------------------------------------------------------------------
router.patch('/:id/refund', requireAdmin, async (req, res) => {
  try {
    const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.refund_status !== 'requested') {
      return res.status(400).json({ error: 'No refund is pending for this order.' });
    }

    await pool.query(`UPDATE orders SET refund_status = 'processed' WHERE id = ?`, [order.id]);
    await addNotification(order.user_id, `Your refund for order #${order.id} has been processed.`);

    res.json({ message: 'Refund marked as processed.' });
  } catch (err) {
    console.error('Process refund error:', err);
    res.status(500).json({ error: 'Could not process the refund.' });
  }
});

module.exports = router;
