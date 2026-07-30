'use strict';

/**
 * GET /api/admins
 * Returns the list of admin accounts for the dashboard. Access is granted
 * either by a valid admin session token (Authorization: Bearer <token>) or by
 * the legacy ADMIN_API_KEY via the "x-api-key" header.
 *
 * Password hashes are never included in the response — only a derived
 * sign-in method is exposed.
 */

const { listAdmins } = require('../lib/db');
const { verifyToken, getBearerToken } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const admin = verifyToken(getBearerToken(req));
  const apiKey = req.headers['x-api-key'];
  const expected = process.env.ADMIN_API_KEY;
  const apiKeyOk = Boolean(expected) && apiKey === expected;

  if (!admin && !apiKeyOk) {
    return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  }

  try {
    const rows = await listAdmins();
    const data = rows.map(function (a) {
      return {
        id: a.id,
        name: a.name,
        email: a.email,
        has_password: Boolean(a.password_hash),
        has_google: Boolean(a.google_id),
        created_at: a.created_at,
      };
    });
    return res.json({ ok: true, total: data.length, data });
  } catch (err) {
    console.error('Failed to list admins:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load admins.' });
  }
};
