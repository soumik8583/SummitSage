'use strict';

/**
 * GET /api/admin/session
 * Returns the current admin if the Bearer token is valid — used by the
 * dashboard to guard access on load.
 */

const { verifyToken, getBearerToken } = require('../../lib/auth');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const payload = verifyToken(getBearerToken(req));
  if (!payload) {
    return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  }

  return res.json({
    ok: true,
    admin: { id: payload.sub, name: payload.name, email: payload.email },
  });
};
