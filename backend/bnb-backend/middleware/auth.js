const jwt = require('jsonwebtoken');

// Reads "Authorization: Bearer <token>" and attaches the decoded
// payload (e.g. { id, email, type }) to req.user. Rejects the request
// with 401 if the token is missing, malformed, or expired.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid authorization token.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
}

// Like requireAuth, but also checks the token belongs to an admin account
// (type === 'admin'), for routes only staff/admins should reach.
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
