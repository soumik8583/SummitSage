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
    // Keep the response light: uploaded images are stored as data URLs, so
    // point the card at the image endpoint instead of inlining the blob.
    const data = rows.map(function (t) {
      const o = Object.assign({}, t);
      if (typeof t.image === 'string' && /^data:/i.test(t.image)) {
        o.image = '/api/trek-image?id=' + t.id;
      }
      return o;
    });
    return res.json({ ok: true, total: data.length, data });
  } catch (err) {
    console.error('Failed to list treks:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load treks.' });
  }
};
