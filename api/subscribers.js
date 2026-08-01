'use strict';

/**
 * /api/subscribers
 *   GET     list newsletter subscribers
 *   PUT     edit a subscriber (?id= or body.id)
 *   DELETE  remove a subscriber (?id= or body.id)
 *
 * Access is granted either by a valid admin session token
 * (Authorization: Bearer <token>) or by the legacy ADMIN_API_KEY supplied via
 * the "x-api-key" header.
 *
 * Optional GET query params:
 *   limit   page size (max 500, default 200)
 *   offset  pagination offset
 */

const { listSubscribers, updateSubscriber, deleteSubscriber } = require('../lib/db');
const { verifyToken, getBearerToken } = require('../lib/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isAuthorised(req) {
  if (verifyToken(getBearerToken(req))) return true;
  const expected = process.env.ADMIN_API_KEY;
  return Boolean(expected) && req.headers['x-api-key'] === expected;
}

function clean(v, max) {
  if (v === undefined || v === null) return undefined;
  return String(v).trim().slice(0, max || 200);
}

function toId(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

module.exports = async (req, res) => {
  if (!isAuthorised(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  }

  const query = req.query || {};

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const id = toId(query.id || (req.body && req.body.id));
    if (!id) return res.status(400).json({ ok: false, error: 'A subscriber id is required.' });
    try {
      await deleteSubscriber(id);
      return res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete subscriber:', err);
      return res.status(500).json({ ok: false, error: 'Failed to delete the subscriber.' });
    }
  }

  // ── PUT / PATCH (edit) ──────────────────────────────────────────────────────
  if (req.method === 'PUT' || req.method === 'PATCH') {
    const body = req.body || {};
    const id = toId(body.id || query.id);
    if (!id) return res.status(400).json({ ok: false, error: 'A subscriber id is required.' });

    const data = {};
    if (body.email !== undefined) data.email = clean(body.email, 160);
    if (body.source !== undefined) data.source = clean(body.source, 80) || null;

    if (data.email !== undefined && !EMAIL_RE.test(data.email)) {
      return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ ok: false, error: 'No fields to update.' });

    try {
      const result = await updateSubscriber(id, data);
      if (!result.updated) return res.status(404).json({ ok: false, error: 'Subscriber not found.' });
      return res.json({ ok: true, id });
    } catch (err) {
      const msg = (err && err.message) || '';
      if (/UNIQUE|constraint/i.test(msg)) {
        return res.status(409).json({ ok: false, error: 'Another subscriber already uses this email.' });
      }
      console.error('Failed to update subscriber:', err);
      return res.status(500).json({ ok: false, error: 'Could not update the subscriber right now.' });
    }
  }

  // ── GET (list) ──────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const limit = Math.min(parseInt(query.limit, 10) || 200, 500);
    const offset = parseInt(query.offset, 10) || 0;
    try {
      const { total, rows } = await listSubscribers({ limit, offset });
      return res.json({ ok: true, total, count: rows.length, data: rows });
    } catch (err) {
      console.error('Failed to list subscribers:', err);
      return res.status(500).json({ ok: false, error: 'Failed to load subscribers.' });
    }
  }

  res.setHeader('Allow', 'GET, PUT, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed.' });
};
