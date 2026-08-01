'use strict';

/**
 * /api/admins
 *   GET     list admin accounts (any signed-in admin)
 *   PUT     edit an admin — name, email, password, super flag (SUPER ADMIN ONLY)
 *   DELETE  remove an admin (SUPER ADMIN ONLY)
 *
 * Access is granted either by a valid admin session token
 * (Authorization: Bearer <token>) or by the legacy ADMIN_API_KEY via the
 * "x-api-key" header. Editing/deleting admins additionally requires the
 * requester to be a super admin (the API key is treated as super).
 *
 * Password hashes are never included in responses — only a derived sign-in
 * method and the super-admin flag are exposed.
 */

const {
  listAdmins, getAdminById, updateAdmin, deleteAdmin, countSuperAdmins,
} = require('../lib/db');
const { verifyToken, getBearerToken, hashPassword } = require('../lib/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function apiKeyOk(req) {
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

function truthy(v) {
  return v === true || v === 1 || v === '1' || v === 'true' || v === 'on';
}

// Resolve the requester: { authed, super, id }. Super rights come from either
// the API key (master) or an admin record flagged is_super.
async function resolveRequester(req) {
  if (apiKeyOk(req)) return { authed: true, super: true, id: null };
  const payload = verifyToken(getBearerToken(req));
  if (!payload) return { authed: false, super: false, id: null };
  let isSuper = false;
  try {
    const me = await getAdminById(payload.sub);
    isSuper = Boolean(me && Number(me.is_super) === 1);
  } catch (e) {
    isSuper = false;
  }
  return { authed: true, super: isSuper, id: payload.sub != null ? Number(payload.sub) : null };
}

module.exports = async (req, res) => {
  const who = await resolveRequester(req);
  if (!who.authed) {
    return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  }

  const query = req.query || {};

  // ── DELETE (super admin only) ───────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!who.super) return res.status(403).json({ ok: false, error: 'Only a super admin can delete admins.' });
    const id = toId(query.id || (req.body && req.body.id));
    if (!id) return res.status(400).json({ ok: false, error: 'An admin id is required.' });
    if (who.id && who.id === id) {
      return res.status(400).json({ ok: false, error: 'You cannot delete your own account.' });
    }
    try {
      const target = await getAdminById(id);
      if (!target) return res.status(404).json({ ok: false, error: 'Admin not found.' });
      if (Number(target.is_super) === 1 && (await countSuperAdmins()) <= 1) {
        return res.status(400).json({ ok: false, error: 'Cannot delete the last super admin.' });
      }
      await deleteAdmin(id);
      return res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete admin:', err);
      return res.status(500).json({ ok: false, error: 'Failed to delete the admin.' });
    }
  }

  // ── PUT / PATCH (super admin only) ──────────────────────────────────────────
  if (req.method === 'PUT' || req.method === 'PATCH') {
    if (!who.super) return res.status(403).json({ ok: false, error: 'Only a super admin can edit admins.' });
    const body = req.body || {};
    const id = toId(body.id || query.id);
    if (!id) return res.status(400).json({ ok: false, error: 'An admin id is required.' });

    const target = await getAdminById(id);
    if (!target) return res.status(404).json({ ok: false, error: 'Admin not found.' });

    const data = {};
    if (body.name !== undefined) data.name = clean(body.name, 120);
    if (body.email !== undefined) data.email = clean(body.email, 160);
    if (body.is_super !== undefined) data.is_super = truthy(body.is_super) ? 1 : 0;

    const password = typeof body.password === 'string' ? body.password : '';
    if (password) {
      if (password.length < 8) return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters.' });
      data.password_hash = hashPassword(password);
    }

    const errors = [];
    if (data.name !== undefined && data.name.length < 2) errors.push('Please enter a name.');
    if (data.email !== undefined && !EMAIL_RE.test(data.email)) errors.push('Please enter a valid email address.');
    if (errors.length) return res.status(400).json({ ok: false, errors });
    if (Object.keys(data).length === 0) return res.status(400).json({ ok: false, error: 'No fields to update.' });

    // Guard: never leave the system without a super admin.
    if (data.is_super === 0 && Number(target.is_super) === 1 && (await countSuperAdmins()) <= 1) {
      return res.status(400).json({ ok: false, error: 'At least one super admin is required.' });
    }

    try {
      await updateAdmin(id, data);
      return res.json({ ok: true, id });
    } catch (err) {
      const msg = (err && err.message) || '';
      if (/UNIQUE|constraint/i.test(msg)) {
        return res.status(409).json({ ok: false, error: 'Another admin already uses this email.' });
      }
      console.error('Failed to update admin:', err);
      return res.status(500).json({ ok: false, error: 'Could not update the admin right now.' });
    }
  }

  // ── GET (list) ──────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const rows = await listAdmins();
      const data = rows.map(function (a) {
        return {
          id: a.id,
          name: a.name,
          email: a.email,
          has_password: Boolean(a.password_hash),
          has_google: Boolean(a.google_id),
          is_super: Number(a.is_super) === 1,
          created_at: a.created_at,
        };
      });
      return res.json({ ok: true, total: data.length, data });
    } catch (err) {
      console.error('Failed to list admins:', err);
      return res.status(500).json({ ok: false, error: 'Failed to load admins.' });
    }
  }

  res.setHeader('Allow', 'GET, PUT, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed.' });
};
