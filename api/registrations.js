'use strict';

/**
 * /api/registrations — the dedicated "User Registered Trek" table.
 *   GET     list trek registrations
 *   PUT     edit a registration (?id= or body.id)
 *   DELETE  remove a registration (?id= or body.id)
 *
 * Access is granted either by a valid admin session token
 * (Authorization: Bearer <token>) or by the legacy ADMIN_API_KEY supplied via
 * the "x-api-key" header.
 *
 * Optional GET query params:
 *   limit   page size (max 500, default 200)
 *   offset  pagination offset
 */

const {
  listTrekRegistrations, updateTrekRegistration, deleteTrekRegistration,
} = require('../lib/db');
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
    if (!id) return res.status(400).json({ ok: false, error: 'A registration id is required.' });
    try {
      await deleteTrekRegistration(id);
      return res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete registration:', err);
      return res.status(500).json({ ok: false, error: 'Failed to delete the registration.' });
    }
  }

  // ── PUT / PATCH (edit) ──────────────────────────────────────────────────────
  if (req.method === 'PUT' || req.method === 'PATCH') {
    const body = req.body || {};
    const id = toId(body.id || query.id);
    if (!id) return res.status(400).json({ ok: false, error: 'A registration id is required.' });

    const data = {};
    if (body.name !== undefined) data.name = clean(body.name, 120);
    if (body.email !== undefined) data.email = clean(body.email, 160);
    if (body.phone !== undefined) data.phone = clean(body.phone, 40) || null;
    if (body.people !== undefined) {
      const n = parseInt(body.people, 10);
      data.people = Number.isFinite(n) && n > 0 ? n : null;
    }
    if (body.city !== undefined) data.city = clean(body.city, 80) || null;
    if (body.tshirt_size !== undefined || body.tShirtSize !== undefined) {
      data.tshirt_size = clean(body.tshirt_size !== undefined ? body.tshirt_size : body.tShirtSize, 10) || null;
    }
    if (body.emergency_contact !== undefined || body.emergencyContact !== undefined) {
      data.emergency_contact = clean(body.emergency_contact !== undefined ? body.emergency_contact : body.emergencyContact, 200) || null;
    }
    if (body.trek !== undefined) data.trek = clean(body.trek, 160) || null;
    if (body.message !== undefined) data.message = clean(body.message, 4000) || null;

    const errors = [];
    if (data.name !== undefined && data.name.length < 2) errors.push('Please enter a name.');
    if (data.email !== undefined && !EMAIL_RE.test(data.email)) errors.push('Please enter a valid email address.');
    if (errors.length) return res.status(400).json({ ok: false, errors });
    if (Object.keys(data).length === 0) return res.status(400).json({ ok: false, error: 'No fields to update.' });

    try {
      const result = await updateTrekRegistration(id, data);
      if (!result.updated) return res.status(404).json({ ok: false, error: 'Registration not found.' });
      return res.json({ ok: true, id });
    } catch (err) {
      console.error('Failed to update registration:', err);
      return res.status(500).json({ ok: false, error: 'Could not update the registration right now.' });
    }
  }

  // ── GET (list) ──────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const limit = Math.min(parseInt(query.limit, 10) || 200, 500);
    const offset = parseInt(query.offset, 10) || 0;
    try {
      const { total, rows } = await listTrekRegistrations({ limit, offset });
      return res.json({ ok: true, total, count: rows.length, data: rows });
    } catch (err) {
      console.error('Failed to list registrations:', err);
      return res.status(500).json({ ok: false, error: 'Failed to load registrations.' });
    }
  }

  res.setHeader('Allow', 'GET, PUT, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed.' });
};
