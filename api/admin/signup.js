'use strict';

/**
 * POST /api/admin/signup
 * Create a new admin account. Gated by the ADMIN_SIGNUP_CODE invite code so
 * the public cannot self-register and read user data.
 */

const { createAdmin, getAdminByEmail } = require('../../lib/db');
const { hashPassword, signToken } = require('../../lib/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const body = req.body || {};
  const name = (typeof body.name === 'string' ? body.name : '').trim().slice(0, 120);
  const email = (typeof body.email === 'string' ? body.email : '').trim().toLowerCase().slice(0, 160);
  const password = typeof body.password === 'string' ? body.password : '';
  const code = typeof body.code === 'string' ? body.code : '';

  const expectedCode = process.env.ADMIN_SIGNUP_CODE;
  if (!expectedCode) {
    return res.status(503).json({
      ok: false,
      error: 'Admin signup is disabled. Set the ADMIN_SIGNUP_CODE environment variable to enable it.',
    });
  }
  if (code !== expectedCode) {
    return res.status(403).json({ ok: false, error: 'Invalid signup code.' });
  }

  const errors = [];
  if (name.length < 2) errors.push('Please enter your name.');
  if (!EMAIL_RE.test(email)) errors.push('Please enter a valid email address.');
  if (password.length < 8) errors.push('Password must be at least 8 characters.');
  if (errors.length > 0) {
    return res.status(400).json({ ok: false, errors });
  }

  if (!process.env.ADMIN_JWT_SECRET) {
    return res.status(503).json({ ok: false, error: 'Server auth is not configured (ADMIN_JWT_SECRET).' });
  }

  try {
    const existing = await getAdminByEmail(email);
    if (existing) {
      return res.status(409).json({ ok: false, error: 'An admin with this email already exists.' });
    }

    const admin = await createAdmin({
      name,
      email,
      password_hash: hashPassword(password),
      google_id: null,
    });

    const token = signToken({ sub: admin.id, name, email });
    return res.status(201).json({ ok: true, token, admin: { id: admin.id, name, email } });
  } catch (err) {
    console.error('Admin signup failed:', (err && err.message) || err);
    return res.status(500).json({ ok: false, error: 'Could not create the admin account right now.' });
  }
};
