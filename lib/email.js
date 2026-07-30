'use strict';

/**
 * Email notifications for Summit Sage form submissions.
 *
 * Sends mail over SMTP (Nodemailer) using the summitsage.in mailbox hosted on
 * Hostinger, so every notification is both sent from and delivered to the same
 * branded address (admin@summitsage.in). One template covers every form type
 * (contact, trek registration, corporate enquiry, community / ambassador
 * sign-up, review, newsletter).
 *
 * Required environment variables (set these on Vercel):
 *   SMTP_HOST     SMTP server host. Defaults to smtp.hostinger.com.
 *   SMTP_PORT     SMTP port. Defaults to 465 (implicit TLS/SSL).
 *   SMTP_USER     The mailbox that sends the mail. Defaults to admin@summitsage.in.
 *   SMTP_PASS     The mailbox password (required). Store it as a secret.
 *   MAIL_FROM     Optional. The From address. Defaults to SMTP_USER.
 *   NOTIFY_EMAIL  Optional. Recipient(s), comma-separated. Defaults to
 *                 admin@summitsage.in.
 */

const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_USER = process.env.SMTP_USER || 'admin@summitsage.in';
const SMTP_PASS = process.env.SMTP_PASS || '';
// The address every notification is sent from (and, by default, to).
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER;
// Recipient(s) of every submission. Comma-separated for multiple inboxes.
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'admin@summitsage.in';

const NAVY = '#0A1628';
const ORANGE = '#E85D04';

let transporter = null;

function isEmailConfigured() {
  return Boolean(SMTP_PASS);
}

function getTransporter() {
  if (!isEmailConfigured()) {
    throw new Error(
      'Email is not configured: set the SMTP_PASS environment variable.'
    );
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      // Bound each phase of the SMTP exchange so a slow/stuck connection fails
      // cleanly (caught as an email error) instead of hanging the function.
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 25000,
    });
  }
  return transporter;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const FORM_LABELS = {
  contact: 'New contact enquiry',
  registration: 'New trek registration',
  corporate: 'New corporate / group enquiry',
  community: 'New community sign-up',
  ambassador: 'New ambassador application',
  review: 'New trekker review',
  waitlist: 'New waitlist request',
  newsletter: 'New newsletter subscriber',
};

function row(label, value) {
  return (
    `<tr>` +
    `<td style="padding:6px 18px 6px 0;color:#5b6b82;vertical-align:top;white-space:nowrap">${escapeHtml(
      label
    )}</td>` +
    `<td style="padding:6px 0;color:${NAVY};font-weight:600">${escapeHtml(value)}</td>` +
    `</tr>`
  );
}

/**
 * Send a form submission to the Summit Sage inbox(es).
 *
 * @param {object} data
 * @param {string} data.form_type   contact | registration | corporate | community | ...
 * @param {string} data.name
 * @param {string} data.email
 * @param {string} [data.phone]
 * @param {string} [data.subject]   trek name / enquiry type
 * @param {string} [data.message]
 * @param {object} [data.details]   any extra structured fields
 * @returns {Promise<void>} resolves once the email is accepted by Gmail.
 */
async function sendSubmissionEmail(data) {
  const tx = getTransporter();

  const type = data.form_type || 'contact';
  const heading = FORM_LABELS[type] || 'New website submission';

  const submittedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });

  const name = data.name || 'Unknown';
  const email = data.email || 'Not provided';
  const phone = data.phone || 'Not provided';
  const subject = data.subject || '';
  const message = data.message || '';

  // Plain-text version.
  let text =
    `${heading}\n\n` +
    `Name:      ${name}\n` +
    `Email:     ${email}\n` +
    `Phone:     ${phone}\n`;
  if (subject) text += `Subject:   ${subject}\n`;
  text += `Submitted: ${submittedAt}\n`;

  // Extra structured details (trek dates, group size, budget, rating, etc.).
  const details = data.details && typeof data.details === 'object' ? data.details : null;
  let detailRows = '';
  if (details) {
    text += `\nDetails:\n`;
    Object.keys(details).forEach(function (key) {
      const val = details[key];
      if (val === undefined || val === null || val === '') return;
      const pretty = String(key)
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, function (c) {
          return c.toUpperCase();
        });
      text += `  ${pretty}: ${val}\n`;
      detailRows += row(pretty, val);
    });
  }
  if (message) text += `\nMessage:\n${message}\n`;

  const html =
    `<div style="background:#f4f6fb;padding:24px;font-family:'Segoe UI',Arial,Helvetica,sans-serif">` +
    `<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(10,22,40,.12)">` +
    `<div style="background:${NAVY};padding:22px 28px">` +
    `<span style="display:inline-block;color:#fff;font-size:18px;font-weight:800;letter-spacing:.4px">Summit<span style="color:${ORANGE}">Sage</span></span>` +
    `<div style="color:#9fb0c9;font-size:12px;margin-top:2px;letter-spacing:2px;text-transform:uppercase">Trek • Ascend • Belong</div>` +
    `</div>` +
    `<div style="padding:28px">` +
    `<div style="display:inline-block;background:${ORANGE};color:#fff;font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:.6px">${escapeHtml(
      type
    )}</div>` +
    `<h2 style="margin:14px 0 18px;color:${NAVY};font-size:22px">${escapeHtml(heading)}</h2>` +
    `<table style="border-collapse:collapse;width:100%;font-size:14px">` +
    row('Name', name) +
    row('Email', email) +
    row('Phone', phone) +
    (subject ? row('Subject', subject) : '') +
    row('Submitted', submittedAt) +
    detailRows +
    `</table>` +
    (message
      ? `<p style="margin:20px 0 6px;color:#5b6b82;font-size:13px;text-transform:uppercase;letter-spacing:.6px">Message</p>` +
        `<p style="white-space:pre-wrap;border-left:3px solid ${ORANGE};padding-left:14px;margin:0;color:${NAVY};line-height:1.6">${escapeHtml(
          message
        )}</p>`
      : '') +
    `</div>` +
    `<div style="padding:16px 28px;background:#f4f6fb;color:#8493a8;font-size:12px;text-align:center">Sent automatically from the Summit Sage website</div>` +
    `</div></div>`;

  const subjectLine =
    `[Summit Sage] ${heading}` + (subject ? ` — ${subject}` : ` from ${name}`);

  await tx.sendMail({
    from: `"Summit Sage" <${MAIL_FROM}>`,
    to: NOTIFY_EMAIL,
    replyTo: data.email || undefined,
    subject: subjectLine,
    text,
    html,
  });
}

/**
 * Send a friendly confirmation to the person who just registered for a trek.
 * This is the email the registration form promises ("check your email").
 *
 * @param {object} data
 * @param {string} data.name
 * @param {string} data.email      recipient (the registrant)
 * @param {string} [data.subject]  trek name
 * @param {object} [data.details]  extra fields (people, city, etc.)
 * @returns {Promise<void>}
 */
async function sendConfirmationEmail(data) {
  if (!data || !data.email) return;
  const tx = getTransporter();

  const name = data.name || 'there';
  const trek = data.subject || (data.details && data.details.trek) || 'your trek';

  const text =
    `Hi ${name},\n\n` +
    `Thank you for registering for ${trek} with Summit Sage!\n\n` +
    `We've received your details and our team will reach out on WhatsApp and ` +
    `email shortly to confirm your spot and share the next steps.\n\n` +
    `If you have any questions in the meantime, just reply to this email.\n\n` +
    `See you on the trail,\nTeam Summit Sage`;

  const html =
    `<div style="background:#f4f6fb;padding:24px;font-family:'Segoe UI',Arial,Helvetica,sans-serif">` +
    `<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(10,22,40,.12)">` +
    `<div style="background:${NAVY};padding:22px 28px">` +
    `<span style="display:inline-block;color:#fff;font-size:18px;font-weight:800;letter-spacing:.4px">Summit<span style="color:${ORANGE}">Sage</span></span>` +
    `<div style="color:#9fb0c9;font-size:12px;margin-top:2px;letter-spacing:2px;text-transform:uppercase">Trek • Ascend • Belong</div>` +
    `</div>` +
    `<div style="padding:28px">` +
    `<h2 style="margin:0 0 14px;color:${NAVY};font-size:22px">You're in, ${escapeHtml(
      name
    )}! 🎉</h2>` +
    `<p style="color:#5b6b82;line-height:1.6;margin:0 0 14px">Thank you for registering for ` +
    `<b style="color:${NAVY}">${escapeHtml(trek)}</b> with Summit Sage.</p>` +
    `<p style="color:#5b6b82;line-height:1.6;margin:0 0 14px">We've received your details and our team ` +
    `will reach out on <b>WhatsApp</b> and <b>email</b> shortly to confirm your spot and share the next steps.</p>` +
    `<p style="color:#5b6b82;line-height:1.6;margin:0">Have a question? Just reply to this email — we're happy to help.</p>` +
    `<p style="margin:22px 0 0;color:${NAVY};font-weight:600">See you on the trail,<br>Team Summit Sage</p>` +
    `</div>` +
    `<div style="padding:16px 28px;background:#f4f6fb;color:#8493a8;font-size:12px;text-align:center">Sent automatically from the Summit Sage website</div>` +
    `</div></div>`;

  await tx.sendMail({
    from: `"Summit Sage" <${MAIL_FROM}>`,
    to: data.email,
    subject: `[Summit Sage] Registration received — ${trek}`,
    text,
    html,
  });
}

module.exports = { sendSubmissionEmail, sendConfirmationEmail, isEmailConfigured };
