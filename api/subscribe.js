'use strict';

/**
 * POST /api/subscribe
 * Newsletter sign-up. Stores the address and notifies the team by email.
 * Runs as a Vercel Serverless Function (and locally via server.js).
 */

const { saveSubscriber } = require('../lib/db');
const { sendSubmissionEmail } = require('../lib/email');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const body = req.body || {};

  // Honeypot.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return res.status(200).json({ ok: true });
  }

  const email = (typeof body.email === 'string' ? body.email : '').trim().slice(0, 160);
  const source = (typeof body.source === 'string' ? body.source : 'newsletter')
    .trim()
    .slice(0, 60);

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }

  const [saved] = await Promise.all([
    saveSubscriber({ email, source })
      .then(function () {
        return true;
      })
      .catch(function (err) {
        console.error('Failed to save subscriber:', (err && err.message) || err);
        return false;
      }),
    sendSubmissionEmail({
      form_type: 'newsletter',
      name: 'Newsletter subscriber',
      email,
      subject: 'Newsletter subscription',
      details: { source },
    }).catch(function (err) {
      console.error('Failed to email subscriber:', (err && err.message) || err);
    }),
  ]);

  return res.status(201).json({
    ok: true,
    saved: Boolean(saved),
    message: "You're on the list! Watch your inbox for the next expedition.",
  });
};
