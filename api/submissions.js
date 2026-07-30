'use strict';

/**
 * GET /api/submissions
 * Returns stored submissions for the team. Access is granted either by a valid
 * admin session token (Authorization: Bearer <token>) or by the legacy
 * ADMIN_API_KEY supplied via the "x-api-key" header.
 *
 * Optional query params:
 *   type    filter by form_type (contact, registration, corporate, …)
 *   limit   page size (max 200, default 50)
 *   offset  pagination offset
 */

const { listSubmissions } = require('../lib/db');
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

  const query = req.query || {};
  const limit = Math.min(parseInt(query.limit, 10) || 50, 200);
  const offset = parseInt(query.offset, 10) || 0;
  const type = typeof query.type === 'string' && query.type ? query.type : null;

  try {
    const { total, rows } = await listSubmissions({ limit, offset, type });
    return res.json({ ok: true, total, count: rows.length, data: rows });
  } catch (err) {
    console.error('Failed to list submissions:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load submissions.' });
  }
};
