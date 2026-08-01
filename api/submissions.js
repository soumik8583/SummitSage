'use strict';

/**
 * /api/submissions
 *   GET     list stored submissions
 *   PUT     edit a submission (?id= or body.id)
 *   DELETE  remove a submission (?id= or body.id)
 *
 * Access is granted either by a valid admin session token
 * (Authorization: Bearer <token>) or by the legacy ADMIN_API_KEY supplied via
 * the "x-api-key" header.
 *
 * Optional GET query params:
 *   type    filter by form_type (contact, registration, corporate, …)
 *   limit   page size (max 200, default 50)
 *   offset  pagination offset
 */

const { listSubmissions, updateSubmission, deleteSubmission } = require('../lib/db');
const { verifyToken, getBearerToken } = require('../lib/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isAuthorised(req) {
  if (verifyToken(getBearerToken(req))) return true;
  const expected = process.env.ADMIN_API_KEY;
  return Boolean(expected) && req.headers['x-api-key'] === expected;
}

function clean(v, max) {
  if (v === undefined || v === null) return undefined;
  return String(v).trim().slice(0, max || 4000);
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
    if (!id) return res.status(400).json({ ok: false, error: 'A submission id is required.' });
    try {
      await deleteSubmission(id);
      return res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete submission:', err);
      return res.status(500).json({ ok: false, error: 'Failed to delete the submission.' });
    }
  }

  // ── PUT / PATCH (edit) ──────────────────────────────────────────────────────
  if (req.method === 'PUT' || req.method === 'PATCH') {
    const body = req.body || {};
    const id = toId(body.id || query.id);
    if (!id) return res.status(400).json({ ok: false, error: 'A submission id is required.' });

    const data = {};
    if (body.name !== undefined) data.name = clean(body.name, 120);
    if (body.email !== undefined) data.email = clean(body.email, 160);
    if (body.phone !== undefined) data.phone = clean(body.phone, 40) || null;
    if (body.form_type !== undefined || body.type !== undefined) {
      data.form_type = clean(body.form_type !== undefined ? body.form_type : body.type, 40);
    }
    if (body.subject !== undefined) data.subject = clean(body.subject, 200) || null;
    if (body.message !== undefined) data.message = clean(body.message, 4000) || null;

    const errors = [];
    if (data.name !== undefined && data.name.length < 2) errors.push('Please enter a name.');
    if (data.email !== undefined && !EMAIL_RE.test(data.email)) errors.push('Please enter a valid email address.');
    if (errors.length) return res.status(400).json({ ok: false, errors });
    if (Object.keys(data).length === 0) return res.status(400).json({ ok: false, error: 'No fields to update.' });

    try {
      const result = await updateSubmission(id, data);
      if (!result.updated) return res.status(404).json({ ok: false, error: 'Submission not found.' });
      return res.json({ ok: true, id });
    } catch (err) {
      console.error('Failed to update submission:', err);
      return res.status(500).json({ ok: false, error: 'Could not update the submission right now.' });
    }
  }

  // ── GET (list) ──────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
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
  }

  res.setHeader('Allow', 'GET, PUT, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed.' });
};
