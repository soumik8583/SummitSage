'use strict';

/**
 * /api/admin/treks — admin-only trek management (protected).
 *   GET     list all treks (active + inactive)
 *   POST    create a trek
 *   DELETE  remove a trek (?id=<n>)
 *
 * Access via a valid admin session token (Authorization: Bearer <token>) or
 * the legacy ADMIN_API_KEY (x-api-key header).
 */

const { createTrek, listTreks, deleteTrek } = require('../../lib/db');
const { verifyToken, getBearerToken } = require('../../lib/auth');

function isAuthorised(req) {
  if (verifyToken(getBearerToken(req))) return true;
  const expected = process.env.ADMIN_API_KEY;
  return Boolean(expected) && req.headers['x-api-key'] === expected;
}

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function toIntOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function toFloatOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function clean(v, max) {
  if (typeof v !== 'string') return v == null ? '' : String(v);
  return v.trim().slice(0, max || 4000);
}

module.exports = async (req, res) => {
  if (!isAuthorised(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  }

  // ── List ───────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const rows = await listTreks({ activeOnly: false });
      return res.json({ ok: true, total: rows.length, data: rows });
    } catch (err) {
      console.error('Failed to list treks (admin):', err);
      return res.status(500).json({ ok: false, error: 'Failed to load treks.' });
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const id = toIntOrNull((req.query && req.query.id) || (req.body && req.body.id));
    if (!id) return res.status(400).json({ ok: false, error: 'A trek id is required.' });
    try {
      await deleteTrek(id);
      return res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete trek:', err);
      return res.status(500).json({ ok: false, error: 'Failed to delete trek.' });
    }
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body || {};
    const name = clean(body.name, 120);
    const price = toIntOrNull(body.price);

    const errors = [];
    if (name.length < 2) errors.push('Please enter the trek name.');
    if (price === null || price < 0) errors.push('Please enter a valid price.');
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const slug = (clean(body.slug, 80) && slugify(body.slug)) || slugify(name) || ('trek-' + Date.now());

    const record = {
      slug: slug,
      name: name,
      region: clean(body.region, 80),
      base: clean(body.base, 80),
      difficulty: clean(body.difficulty, 40) || 'Moderate',
      season: clean(body.season, 40),
      days: toIntOrNull(body.days),
      distance_km: toIntOrNull(body.distanceKm),
      max_altitude: toIntOrNull(body.maxAltitude),
      price: price,
      early_bird: toIntOrNull(body.earlyBird),
      total_seats: toIntOrNull(body.totalSeats),
      seats_left: toIntOrNull(body.seatsLeft),
      start_date: clean(body.startDate, 40) || null,
      rating: toFloatOrNull(body.rating),
      image: clean(body.image, 500),
      tags: clean(body.tags, 300),
      blurb: clean(body.blurb, 600),
      description: clean(body.description, 6000),
      highlights: clean(body.highlights, 2000),
      active: body.active === false || body.active === 'false' ? 0 : 1,
    };

    try {
      const created = await createTrek(record);
      return res.status(201).json({ ok: true, id: created.id, slug: created.slug });
    } catch (err) {
      const msg = (err && err.message) || '';
      if (/UNIQUE|constraint/i.test(msg)) {
        return res.status(409).json({ ok: false, error: 'A trek with this name/slug already exists.' });
      }
      console.error('Failed to create trek:', msg);
      return res.status(500).json({ ok: false, error: 'Could not save the trek right now.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed.' });
};
