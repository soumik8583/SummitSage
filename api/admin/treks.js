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

const { createTrek, listTreks, getTrekById, updateTrek, deleteTrek } = require('../../lib/db');
const { verifyToken, getBearerToken } = require('../../lib/auth');

const MAX_IMAGE_LEN = 2000000; // ~2MB of base64 data URL

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

function pick(body, a, b) {
  return body[a] !== undefined ? body[a] : body[b];
}

// Map an incoming request body (friendly names) to trek columns. Only keys
// that are present are returned, so it serves both create and update.
function mapBody(body) {
  const out = {};
  if (body.name !== undefined) out.name = clean(body.name, 120);
  if (body.location !== undefined || body.region !== undefined) out.region = clean(pick(body, 'location', 'region'), 120);
  if (body.base !== undefined) out.base = clean(body.base, 80);
  if (body.difficulty !== undefined) out.difficulty = clean(body.difficulty, 40);
  if (body.season !== undefined) out.season = clean(body.season, 40);
  if (body.days !== undefined) out.days = toIntOrNull(body.days);
  if (body.altitude !== undefined || body.maxAltitude !== undefined) out.max_altitude = toIntOrNull(pick(body, 'altitude', 'maxAltitude'));
  if (body.distanceKm !== undefined) out.distance_km = toIntOrNull(body.distanceKm);
  if (body.price !== undefined) out.price = toIntOrNull(body.price);
  if (body.earlyBird !== undefined) out.early_bird = toIntOrNull(body.earlyBird);
  if (body.totalSeats !== undefined) out.total_seats = toIntOrNull(body.totalSeats);
  if (body.seatsLeft !== undefined) out.seats_left = toIntOrNull(body.seatsLeft);
  if (body.startDate !== undefined) out.start_date = clean(body.startDate, 40) || null;
  if (body.endDate !== undefined) out.end_date = clean(body.endDate, 40) || null;
  if (body.rating !== undefined) out.rating = toFloatOrNull(body.rating);
  if (body.tags !== undefined) out.tags = clean(body.tags, 300);
  if (body.blurb !== undefined) out.blurb = clean(body.blurb, 600);
  if (body.description !== undefined || body.details !== undefined) out.description = clean(pick(body, 'description', 'details'), 8000);
  if (body.highlights !== undefined) out.highlights = clean(body.highlights, 2000);
  // Image may be a data URL (uploaded) or a plain https URL — don't slice.
  if (body.image !== undefined) out.image = typeof body.image === 'string' ? body.image.trim() : '';
  return out;
}

module.exports = async (req, res) => {
  if (!isAuthorised(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  }

  const query = req.query || {};

  // ── Fetch one / list ────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const id = toIntOrNull(query.id);
    try {
      if (id) {
        const trek = await getTrekById(id);
        if (!trek) return res.status(404).json({ ok: false, error: 'Trek not found.' });
        return res.json({ ok: true, data: trek });
      }
      // Light list — drop the (potentially large) image blob.
      const rows = await listTreks({ activeOnly: false });
      const data = rows.map(function (t) {
        const o = Object.assign({}, t);
        o.has_image = Boolean(t.image);
        delete o.image;
        return o;
      });
      return res.json({ ok: true, total: data.length, data });
    } catch (err) {
      console.error('Failed to read treks (admin):', err);
      return res.status(500).json({ ok: false, error: 'Failed to load treks.' });
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const id = toIntOrNull(query.id || (req.body && req.body.id));
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
    const mapped = mapBody(body);
    const name = mapped.name || '';
    const price = mapped.price;

    const errors = [];
    if (!name || name.length < 2) errors.push('Please enter the trek name.');
    if (price === null || price === undefined || price < 0) errors.push('Please enter a valid price.');
    if (mapped.image && mapped.image.length > MAX_IMAGE_LEN) errors.push('The image is too large. Please use a smaller image.');
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const slug = (clean(body.slug, 80) && slugify(body.slug)) || slugify(name) || ('trek-' + Date.now());
    const record = Object.assign({ slug: slug, difficulty: 'Moderate', active: 1 }, mapped);

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

  // ── Update ──────────────────────────────────────────────────────────────────
  if (req.method === 'PUT' || req.method === 'PATCH') {
    const body = req.body || {};
    const id = toIntOrNull(body.id || query.id);
    if (!id) return res.status(400).json({ ok: false, error: 'A trek id is required.' });

    const mapped = mapBody(body);
    if (mapped.image && mapped.image.length > MAX_IMAGE_LEN) {
      return res.status(400).json({ ok: false, error: 'The image is too large. Please use a smaller image.' });
    }
    if (Object.keys(mapped).length === 0) {
      return res.status(400).json({ ok: false, error: 'No fields to update.' });
    }

    try {
      await updateTrek(id, mapped);
      return res.json({ ok: true, id: id });
    } catch (err) {
      console.error('Failed to update trek:', (err && err.message) || err);
      return res.status(500).json({ ok: false, error: 'Could not update the trek right now.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed.' });
};
