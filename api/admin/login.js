'use strict';

/**
 * POST /api/admin/login
 * Authenticate an admin with email + password and return a session token.
 */

const { getAdminByEmail } = require('../../lib/db');
const { verifyPassword, signToken } = require('../../lib/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const body = req.body || {};
  const email = (typeof body.email === 'string' ? body.email : '').trim().toLowerCase().slice(0, 160);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!EMAIL_RE.test(email) || !password) {
    return res.status(400).json({ ok: false, error: 'Please enter your email and password.' });
  }

  if (!process.env.ADMIN_JWT_SECRET) {
    return res.status(503).json({ ok: false, error: 'Server auth is not configured (ADMIN_JWT_SECRET).' });
  }

  try {
    const admin = await getAdminByEmail(email);
    // Always run through verify to reduce timing differences; use a dummy hash
    // when the admin is missing or has no password (Google-only account).
    const stored = admin && admin.password_hash
      ? admin.password_hash
      : 'scrypt$00$00';
    const ok = verifyPassword(password, stored);

    if (!admin || !admin.password_hash || !ok) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
    }

    const token = signToken({ sub: admin.id, name: admin.name, email: admin.email });
    return res.json({ ok: true, token, admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (err) {
    console.error('Admin login failed:', (err && err.message) || err);
    return res.status(500).json({ ok: false, error: 'Could not sign you in right now.' });
  }
};
