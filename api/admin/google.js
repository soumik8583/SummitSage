'use strict';

/**
 * POST /api/admin/google
 * Sign in an admin with a Google Identity Services credential (ID token).
 *
 * Security:
 *   • Verifies the token with Google and checks the audience matches
 *     GOOGLE_CLIENT_ID and the email is verified.
 *   • Only signs in emails that already have an admin account, unless
 *     ADMIN_ALLOW_GOOGLE_SIGNUP is explicitly set to "true".
 */

const https = require('https');
const { getAdminByEmail, createAdmin, setAdminGoogleId } = require('../../lib/db');
const { signToken } = require('../../lib/auth');

function verifyGoogleToken(idToken) {
  return new Promise((resolve, reject) => {
    const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
    https
      .get(url, (r) => {
        let data = '';
        r.on('data', (c) => (data += c));
        r.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid response from Google.'));
          }
        });
      })
      .on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const body = req.body || {};
  const credential = typeof body.credential === 'string' ? body.credential : '';
  if (!credential) {
    return res.status(400).json({ ok: false, error: 'Missing Google credential.' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({ ok: false, error: 'Google sign-in is not configured.' });
  }
  if (!process.env.ADMIN_JWT_SECRET) {
    return res.status(503).json({ ok: false, error: 'Server auth is not configured (ADMIN_JWT_SECRET).' });
  }

  try {
    const info = await verifyGoogleToken(credential);

    if (info.error || info.error_description || !info.email) {
      return res.status(401).json({ ok: false, error: 'Google verification failed.' });
    }
    if (info.aud !== clientId) {
      return res.status(401).json({ ok: false, error: 'Google token audience mismatch.' });
    }
    if (info.email_verified !== 'true' && info.email_verified !== true) {
      return res.status(401).json({ ok: false, error: 'Your Google email is not verified.' });
    }

    const email = String(info.email).toLowerCase();
    let admin = await getAdminByEmail(email);

    if (!admin) {
      if (process.env.ADMIN_ALLOW_GOOGLE_SIGNUP === 'true') {
        const created = await createAdmin({
          name: info.name || email,
          email,
          password_hash: null,
          google_id: info.sub,
        });
        admin = { id: created.id, name: info.name || email, email };
      } else {
        return res.status(403).json({
          ok: false,
          error: 'No admin account exists for this Google email. Please sign up first.',
        });
      }
    } else if (!admin.google_id) {
      await setAdminGoogleId(admin.id, info.sub);
    }

    const token = signToken({ sub: admin.id, name: admin.name, email: admin.email });
    return res.json({ ok: true, token, admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (err) {
    console.error('Admin Google login failed:', (err && err.message) || err);
    return res.status(500).json({ ok: false, error: 'Could not sign you in with Google right now.' });
  }
};
