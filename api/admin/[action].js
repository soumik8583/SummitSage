'use strict';

/**
 * /api/admin/[action] — consolidated admin API (one Serverless Function).
 *
 * Routes every /api/admin/<action> request to the matching handler so the
 * project stays within Vercel's Hobby-plan function limit. Actions:
 *   config   GET   public front-end config
 *   session  GET   validate the current session
 *   signup   POST  create an admin (invite-code gated)
 *   login    POST  email + password login
 *   google   POST  Google Identity Services login
 *   treks    GET/POST/PUT/DELETE  trek management
 */

const https = require('https');
const {
  createAdmin, getAdminByEmail, getAdminById, setAdminGoogleId, updateAdmin,
  createTrek, listTreks, getTrekById, updateTrek, deleteTrek,
  createAuditSession, closeAuditSession, appendAuditUpdate, listAuditLogs,
} = require('../../lib/db');
const {
  hashPassword, verifyPassword, signToken, verifyToken, getBearerToken,
} = require('../../lib/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_IMAGE_LEN = 2000000;

// ── shared helpers ────────────────────────────────────────────────────────────
function isAuthorised(req) {
  if (verifyToken(getBearerToken(req))) return true;
  const expected = process.env.ADMIN_API_KEY;
  return Boolean(expected) && req.headers['x-api-key'] === expected;
}

// Generate an opaque session id used to correlate an admin's login, the
// updates they make, and their logout in the audit_logs table.
function newSessionId() {
  return require('crypto').randomBytes(16).toString('hex');
}

// Best-effort audit note for a change an admin made during their session.
async function logTrekAudit(req, description) {
  try {
    const payload = verifyToken(getBearerToken(req));
    if (payload && payload.sid) {
      await appendAuditUpdate(payload.sid, description);
    }
  } catch (e) {
    /* auditing must never block the primary action */
  }
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
function slugify(name) {
  return String(name || '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ── config ────────────────────────────────────────────────────────────────────
function handleConfig(req, res) {
  return res.json({
    ok: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    signupEnabled: Boolean(process.env.ADMIN_SIGNUP_CODE),
  });
}

// ── session ───────────────────────────────────────────────────────────────────
async function handleSession(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  const payload = verifyToken(getBearerToken(req));
  if (!payload) return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  // Read the super-admin flag fresh from the DB so privilege changes take
  // effect without needing to sign in again.
  let isSuper = false;
  try {
    const me = await getAdminById(payload.sub);
    isSuper = Boolean(me && Number(me.is_super) === 1);
  } catch (e) {
    isSuper = false;
  }
  return res.json({
    ok: true,
    admin: { id: payload.sub, name: payload.name, email: payload.email, is_super: isSuper },
  });
}

// ── signup ────────────────────────────────────────────────────────────────────
async function handleSignup(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  const body = req.body || {};
  const name = clean(body.name, 120);
  const email = clean(body.email, 160).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const code = typeof body.code === 'string' ? body.code : '';

  const expectedCode = process.env.ADMIN_SIGNUP_CODE;
  if (!expectedCode) {
    return res.status(503).json({ ok: false, error: 'Admin signup is disabled. Set the ADMIN_SIGNUP_CODE environment variable to enable it.' });
  }
  if (code !== expectedCode) return res.status(403).json({ ok: false, error: 'Invalid signup code.' });

  const errors = [];
  if (name.length < 2) errors.push('Please enter your name.');
  if (!EMAIL_RE.test(email)) errors.push('Please enter a valid email address.');
  if (password.length < 8) errors.push('Password must be at least 8 characters.');
  if (errors.length > 0) return res.status(400).json({ ok: false, errors });

  if (!process.env.ADMIN_JWT_SECRET) {
    return res.status(503).json({ ok: false, error: 'Server auth is not configured (ADMIN_JWT_SECRET).' });
  }

  try {
    const existing = await getAdminByEmail(email);
    if (existing) return res.status(409).json({ ok: false, error: 'An admin with this email already exists.' });
    const admin = await createAdmin({ name, email, password_hash: hashPassword(password), google_id: null });
    const sid = newSessionId();
    try { await createAuditSession({ sessionId: sid, admin: { id: admin.id, name, email } }); } catch (e) { /* non-fatal */ }
    const token = signToken({ sub: admin.id, name, email, sid });
    return res.status(201).json({ ok: true, token, admin: { id: admin.id, name, email } });
  } catch (err) {
    console.error('Admin signup failed:', (err && err.message) || err);
    return res.status(500).json({ ok: false, error: 'Could not create the admin account right now.' });
  }
}

// ── login ─────────────────────────────────────────────────────────────────────
async function handleLogin(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  const body = req.body || {};
  const email = clean(body.email, 160).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!EMAIL_RE.test(email) || !password) {
    return res.status(400).json({ ok: false, error: 'Please enter your email and password.' });
  }
  if (!process.env.ADMIN_JWT_SECRET) {
    return res.status(503).json({ ok: false, error: 'Server auth is not configured (ADMIN_JWT_SECRET).' });
  }

  try {
    const admin = await getAdminByEmail(email);
    const stored = admin && admin.password_hash ? admin.password_hash : 'scrypt$00$00';
    const ok = verifyPassword(password, stored);
    if (!admin || !admin.password_hash || !ok) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
    }
    const sid = newSessionId();
    try { await createAuditSession({ sessionId: sid, admin: { id: admin.id, name: admin.name, email: admin.email } }); } catch (e) { /* non-fatal */ }
    const token = signToken({ sub: admin.id, name: admin.name, email: admin.email, sid });
    return res.json({ ok: true, token, admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (err) {
    console.error('Admin login failed:', (err && err.message) || err);
    return res.status(500).json({ ok: false, error: 'Could not sign you in right now.' });
  }
}

// ── google ────────────────────────────────────────────────────────────────────
function verifyGoogleToken(idToken) {
  return new Promise((resolve, reject) => {
    const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
    https.get(url, (r) => {
      let data = '';
      r.on('data', (c) => (data += c));
      r.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Invalid response from Google.')); }
      });
    }).on('error', reject);
  });
}
async function handleGoogle(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  const body = req.body || {};
  const credential = typeof body.credential === 'string' ? body.credential : '';
  if (!credential) return res.status(400).json({ ok: false, error: 'Missing Google credential.' });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(503).json({ ok: false, error: 'Google sign-in is not configured.' });
  if (!process.env.ADMIN_JWT_SECRET) return res.status(503).json({ ok: false, error: 'Server auth is not configured (ADMIN_JWT_SECRET).' });

  try {
    const info = await verifyGoogleToken(credential);
    if (info.error || info.error_description || !info.email) return res.status(401).json({ ok: false, error: 'Google verification failed.' });
    if (info.aud !== clientId) return res.status(401).json({ ok: false, error: 'Google token audience mismatch.' });
    if (info.email_verified !== 'true' && info.email_verified !== true) return res.status(401).json({ ok: false, error: 'Your Google email is not verified.' });

    const email = String(info.email).toLowerCase();
    let admin = await getAdminByEmail(email);
    if (!admin) {
      if (process.env.ADMIN_ALLOW_GOOGLE_SIGNUP === 'true') {
        const created = await createAdmin({ name: info.name || email, email, password_hash: null, google_id: info.sub });
        admin = { id: created.id, name: info.name || email, email };
      } else {
        return res.status(403).json({ ok: false, error: 'No admin account exists for this Google email. Please sign up first.' });
      }
    } else if (!admin.google_id) {
      await setAdminGoogleId(admin.id, info.sub);
    }
    const sid = newSessionId();
    try { await createAuditSession({ sessionId: sid, admin: { id: admin.id, name: admin.name, email: admin.email } }); } catch (e) { /* non-fatal */ }
    const token = signToken({ sub: admin.id, name: admin.name, email: admin.email, sid });
    return res.json({ ok: true, token, admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (err) {
    console.error('Admin Google login failed:', (err && err.message) || err);
    return res.status(500).json({ ok: false, error: 'Could not sign you in with Google right now.' });
  }
}

// ── treks (CRUD) ──────────────────────────────────────────────────────────────
function mapTrekBody(body) {
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
  if (body.image !== undefined) out.image = typeof body.image === 'string' ? body.image.trim() : '';
  if (body.active !== undefined) {
    out.active = (body.active === false || body.active === 'false' || body.active === 0 || body.active === '0') ? 0 : 1;
  }
  return out;
}
async function handleTreks(req, res) {
  if (!isAuthorised(req)) return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  const query = req.query || {};

  if (req.method === 'GET') {
    const id = toIntOrNull(query.id);
    try {
      if (id) {
        const trek = await getTrekById(id);
        if (!trek) return res.status(404).json({ ok: false, error: 'Trek not found.' });
        return res.json({ ok: true, data: trek });
      }
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

  if (req.method === 'DELETE') {
    const id = toIntOrNull(query.id || (req.body && req.body.id));
    if (!id) return res.status(400).json({ ok: false, error: 'A trek id is required.' });
    try {
      let trekName = '';
      try { const t = await getTrekById(id); if (t) trekName = t.name; } catch (e) { /* best-effort */ }
      await deleteTrek(id);
      await logTrekAudit(req, 'Deleted trek "' + (trekName || ('#' + id)) + '"');
      return res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete trek:', err);
      return res.status(500).json({ ok: false, error: 'Failed to delete trek.' });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const mapped = mapTrekBody(body);
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
      await logTrekAudit(req, 'Added trek "' + name + '"');
      return res.status(201).json({ ok: true, id: created.id, slug: created.slug });
    } catch (err) {
      const msg = (err && err.message) || '';
      if (/UNIQUE|constraint/i.test(msg)) return res.status(409).json({ ok: false, error: 'A trek with this name/slug already exists.' });
      console.error('Failed to create trek:', msg);
      return res.status(500).json({ ok: false, error: 'Could not save the trek right now.' });
    }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const body = req.body || {};
    const id = toIntOrNull(body.id || query.id);
    if (!id) return res.status(400).json({ ok: false, error: 'A trek id is required.' });
    const mapped = mapTrekBody(body);
    if (mapped.image && mapped.image.length > MAX_IMAGE_LEN) return res.status(400).json({ ok: false, error: 'The image is too large. Please use a smaller image.' });
    if (Object.keys(mapped).length === 0) return res.status(400).json({ ok: false, error: 'No fields to update.' });
    try {
      await updateTrek(id, mapped);
      await logTrekAudit(req, 'Updated trek "' + (mapped.name || ('#' + id)) + '"');
      return res.json({ ok: true, id: id });
    } catch (err) {
      console.error('Failed to update trek:', (err && err.message) || err);
      return res.status(500).json({ ok: false, error: 'Could not update the trek right now.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed.' });
}

// ── logout ────────────────────────────────────────────────────────────────────
async function handleLogout(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  const payload = verifyToken(getBearerToken(req));
  // Always answer OK so the client can clear its token; only record the
  // logout time when we can identify the session.
  if (payload && payload.sid) {
    try { await closeAuditSession(payload.sid); } catch (e) { /* non-fatal */ }
  }
  return res.json({ ok: true });
}

// ── audit (super admin only) ───────────────────────────────────────────────────
async function handleAudit(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  const payload = verifyToken(getBearerToken(req));
  const viaApiKey = !payload && isAuthorised(req);
  if (!payload && !viaApiKey) return res.status(401).json({ ok: false, error: 'Unauthorized.' });

  // Only super admins (or the master API key) may read the audit trail.
  let isSuper = viaApiKey;
  if (payload) {
    try {
      const me = await getAdminById(payload.sub);
      isSuper = Boolean(me && Number(me.is_super) === 1);
    } catch (e) {
      isSuper = false;
    }
  }
  if (!isSuper) return res.status(403).json({ ok: false, error: 'Only a super admin can view audit logs.' });

  const limit = Math.min(Math.max(toIntOrNull(req.query && req.query.limit) || 200, 1), 500);
  try {
    const { total, rows } = await listAuditLogs({ limit });
    const data = rows.map(function (r) {
      let updates = [];
      try { updates = r.updates ? JSON.parse(r.updates) : []; } catch (e) { updates = []; }
      return {
        id: r.id,
        admin_name: r.admin_name,
        admin_email: r.admin_email,
        login_at: r.login_at,
        logout_at: r.logout_at,
        updates: updates,
      };
    });
    return res.json({ ok: true, total, data });
  } catch (err) {
    console.error('Failed to load audit logs:', (err && err.message) || err);
    return res.status(500).json({ ok: false, error: 'Failed to load audit logs.' });
  }
}

// ── profile (self-service: view + edit your own account) ────────────────────────
async function handleProfile(req, res) {
  const payload = verifyToken(getBearerToken(req));
  if (!payload) return res.status(401).json({ ok: false, error: 'Unauthorized.' });

  let me;
  try {
    me = await getAdminById(payload.sub);
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Could not load your profile right now.' });
  }
  if (!me) return res.status(404).json({ ok: false, error: 'Admin not found.' });

  // View own profile.
  if (req.method === 'GET') {
    return res.json({
      ok: true,
      admin: {
        id: me.id,
        name: me.name,
        email: me.email,
        has_password: Boolean(me.password_hash),
        has_google: Boolean(me.google_id),
        is_super: Number(me.is_super) === 1,
        created_at: me.created_at,
      },
    });
  }

  // Edit own profile — name, email, and (optionally) password only. An admin
  // can never change their own super-admin status here.
  if (req.method === 'PUT' || req.method === 'PATCH') {
    const body = req.body || {};
    const data = {};
    if (body.name !== undefined) data.name = clean(body.name, 120);
    if (body.email !== undefined) data.email = clean(body.email, 160).toLowerCase();

    const password = typeof body.password === 'string' ? body.password : '';
    const errors = [];
    if (data.name !== undefined && data.name.length < 2) errors.push('Please enter your name.');
    if (data.email !== undefined && !EMAIL_RE.test(data.email)) errors.push('Please enter a valid email address.');
    if (password) {
      if (password.length < 8) errors.push('Password must be at least 8 characters.');
      else data.password_hash = hashPassword(password);
    }
    if (errors.length) return res.status(400).json({ ok: false, errors });
    if (Object.keys(data).length === 0) return res.status(400).json({ ok: false, error: 'No changes to save.' });

    try {
      await updateAdmin(me.id, data);
      const updated = await getAdminById(me.id);
      // Re-issue the session token so a new name/email takes effect immediately,
      // keeping the same audit session id (sid) for continuity.
      const token = signToken({ sub: updated.id, name: updated.name, email: updated.email, sid: payload.sid });
      return res.json({
        ok: true,
        token,
        admin: { id: updated.id, name: updated.name, email: updated.email },
      });
    } catch (err) {
      const msg = (err && err.message) || '';
      if (/UNIQUE|constraint/i.test(msg)) {
        return res.status(409).json({ ok: false, error: 'Another admin already uses this email.' });
      }
      console.error('Failed to update profile:', msg);
      return res.status(500).json({ ok: false, error: 'Could not update your profile right now.' });
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ ok: false, error: 'Method not allowed.' });
}

// ── dispatcher ────────────────────────────────────────────────────────────────
const ROUTES = {
  config: handleConfig,
  session: handleSession,
  signup: handleSignup,
  login: handleLogin,
  google: handleGoogle,
  logout: handleLogout,
  audit: handleAudit,
  profile: handleProfile,
  treks: handleTreks,
};

module.exports = (req, res) => {
  const action = (req.query && req.query.action) || '';
  const fn = ROUTES[action];
  if (!fn) return res.status(404).json({ ok: false, error: 'Not found.' });
  return fn(req, res);
};
