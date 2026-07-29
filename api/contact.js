'use strict';

/**
 * POST /api/contact
 *
 * One endpoint for every Summit Sage form: general contact, trek
 * registration, corporate / group enquiry, community & ambassador sign-ups,
 * reviews and waitlist requests. The `formType` field selects the flavour;
 * everything is validated, stored in the Turso database and emailed to the
 * team. Runs as a Vercel Serverless Function (and locally via server.js).
 */

const { saveSubmission } = require('../lib/db');
const { sendSubmissionEmail, sendConfirmationEmail } = require('../lib/email');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_TYPES = [
  'contact',
  'registration',
  'corporate',
  'community',
  'ambassador',
  'review',
  'waitlist',
];

// Extra, per-form fields we accept into the structured `details` payload.
const DETAIL_FIELDS = [
  'trek',
  'trekDate',
  'batch',
  'people',
  'groupSize',
  'budget',
  'season',
  'fitness',
  'experience',
  'company',
  'designation',
  'rating',
  'city',
  'instagram',
  'tShirtSize',
  'emergencyContact',
  'referral',
  'heardFrom',
];

function clean(value, maxLen) {
  if (typeof value !== 'string') {
    if (typeof value === 'number') return String(value);
    return '';
  }
  return value.trim().slice(0, maxLen);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const body = req.body || {};

  // Honeypot: real users leave "website" empty; bots tend to fill it.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return res.status(200).json({ ok: true, id: null });
  }

  const formType = ALLOWED_TYPES.includes(body.formType) ? body.formType : 'contact';

  const value = {
    form_type: formType,
    name: clean(body.name, 120),
    email: clean(body.email, 160),
    phone: clean(body.phone, 40),
    subject: clean(body.subject || body.trek || body.service, 160),
    message: clean(body.message, 4000),
  };

  // Collect any structured extras into details.
  const details = {};
  DETAIL_FIELDS.forEach(function (key) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
      details[key] = clean(String(body[key]), 300);
    }
  });
  if (Object.keys(details).length > 0) value.details = details;

  // Validation — message is optional for registration/community/waitlist.
  const errors = [];
  if (value.name.length < 2) errors.push('Please enter your name.');
  if (!EMAIL_RE.test(value.email)) errors.push('Please enter a valid email address.');

  const requiresMessage = formType === 'contact' || formType === 'corporate';
  if (requiresMessage && value.message.length < 5) {
    errors.push('Please enter a short message.');
  }
  if (
    (formType === 'registration' || formType === 'waitlist') &&
    !value.subject
  ) {
    errors.push('Please tell us which trek you are interested in.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ ok: false, errors });
  }

  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded || '')
      .split(',')[0]
      .trim() || null;

  // Email the submission and store it independently, so a failure in one
  // channel does not block the other. It succeeds if either one works.
  const [emailed, saved] = await Promise.all([
    sendSubmissionEmail(value)
      .then(function () {
        // For trek registrations, also send the registrant a confirmation.
        // Failure here must not affect the team notification result.
        if (formType === 'registration') {
          return sendConfirmationEmail(value)
            .catch(function (err) {
              console.error(
                'Failed to email registrant confirmation:',
                (err && err.message) || err
              );
            })
            .then(function () {
              return true;
            });
        }
        return true;
      })
      .catch(function (err) {
        console.error('Failed to email submission:', (err && err.message) || err);
        return false;
      }),
    saveSubmission({
      ...value,
      ip_address: ip,
      user_agent: clean(req.headers['user-agent'] || '', 300),
    })
      .then(function (row) {
        return row;
      })
      .catch(function (err) {
        console.error('Failed to save submission:', (err && err.message) || err);
        return null;
      }),
  ]);

  if (emailed || saved) {
    return res.status(201).json({
      ok: true,
      emailed: emailed,
      saved: Boolean(saved),
      id: saved ? saved.id : null,
      created_at: saved ? saved.created_at : null,
      message: 'Thank you! Your request has been received.',
    });
  }

  return res.status(502).json({
    ok: false,
    error: 'We could not send your request right now. Please try again shortly.',
  });
};
