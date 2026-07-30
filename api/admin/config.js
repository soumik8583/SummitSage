'use strict';

/**
 * GET /api/admin/config
 * Public, non-sensitive config the admin pages need on load (the Google
 * client ID is a public value, safe to expose).
 */

module.exports = (req, res) => {
  res.json({
    ok: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    signupEnabled: Boolean(process.env.ADMIN_SIGNUP_CODE),
  });
};
