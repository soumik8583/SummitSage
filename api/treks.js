'use strict';

/**
 * GET /api/treks
 * Public endpoint — returns active, admin-managed treks for the main site's
 * trek list. No authentication required.
 */

const { listTreks } = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  try {
    const rows = await listTreks({ activeOnly: true });
    return res.json({ ok: true, total: rows.length, data: rows });
  } catch (err) {
    console.error('Failed to list treks:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load treks.' });
  }
};
