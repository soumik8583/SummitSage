'use strict';

/**
 * Database layer for Summit Sage.
 *
 * Uses Turso (libSQL) via @libsql/client so the same code works:
 *   • Locally — against a SQLite file (file:data/local.db) by default.
 *   • In production (Vercel) — against a hosted Turso database, configured
 *     with the TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment vars.
 *
 * Vercel's filesystem is ephemeral, so a hosted database (Turso) is
 * required for submissions to persist in production.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

const authToken = process.env.TURSO_AUTH_TOKEN;

// A hosted Turso URL is required wherever the filesystem is read-only and
// ephemeral (e.g. Vercel serverless). Only fall back to a local SQLite file
// during local development — never in a serverless/production environment,
// where opening a file database throws and would crash the function at import.
const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_REGION || process.env.LAMBDA_TASK_ROOT
);
const url =
  process.env.TURSO_DATABASE_URL || (isServerless ? '' : 'file:data/local.db');

// Create (and memoise) the libSQL client lazily. Doing this on first use —
// rather than at import time — means a missing or unwritable database surfaces
// as a caught error inside saveSubmission/listSubmissions and can never crash
// the serverless function while it is loading.
let client = null;
let clientInitError = null;

function getClient() {
  if (client) return client;
  if (clientInitError) throw clientInitError;

  try {
    if (!url) {
      throw new Error(
        'Database is not configured: set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN) to enable persistence.'
      );
    }

    // For local file-based databases, make sure the target directory exists.
    if (url.startsWith('file:')) {
      const filePath = url.slice('file:'.length);
      const dir = path.dirname(filePath);
      if (dir && dir !== '.' && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    client = createClient(authToken ? { url, authToken } : { url });
    return client;
  } catch (err) {
    clientInitError = err;
    throw err;
  }
}

// Create the schema once per process (idempotent).
let schemaReady = null;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = getClient().batch(
      [
        `CREATE TABLE IF NOT EXISTS submissions (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          form_type   TEXT    NOT NULL DEFAULT 'contact',
          name        TEXT    NOT NULL,
          email       TEXT    NOT NULL,
          phone       TEXT,
          subject     TEXT,
          message     TEXT,
          details     TEXT,
          ip_address  TEXT,
          user_agent  TEXT,
          created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );`,
        `CREATE TABLE IF NOT EXISTS subscribers (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          email       TEXT    NOT NULL UNIQUE,
          source      TEXT,
          created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );`,
      ],
      'write'
    );
  }
  return schemaReady;
}

/**
 * Persist a form submission of any type (contact, registration, corporate,
 * community, ambassador, review …).
 * @param {object} data
 * @returns {Promise<{id: number, created_at: string}>}
 */
async function saveSubmission(data) {
  await ensureSchema();

  const details =
    data.details && typeof data.details === 'object'
      ? JSON.stringify(data.details)
      : data.details || null;

  const result = await getClient().execute({
    sql: `INSERT INTO submissions
            (form_type, name, email, phone, subject, message, details, ip_address, user_agent)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.form_type || 'contact',
      data.name,
      data.email,
      data.phone || null,
      data.subject || null,
      data.message || null,
      details,
      data.ip_address || null,
      data.user_agent || null,
    ],
  });

  const id = Number(result.lastInsertRowid);
  const row = await getClient().execute({
    sql: 'SELECT created_at FROM submissions WHERE id = ?',
    args: [id],
  });

  return { id, created_at: row.rows[0] ? row.rows[0].created_at : null };
}

/**
 * Add a newsletter subscriber (idempotent on email).
 * @param {{email:string, source?:string}} data
 * @returns {Promise<{email:string}>}
 */
async function saveSubscriber(data) {
  await ensureSchema();

  await getClient().execute({
    sql: `INSERT INTO subscribers (email, source)
          VALUES (?, ?)
          ON CONFLICT(email) DO NOTHING`,
    args: [data.email, data.source || null],
  });

  return { email: data.email };
}

/**
 * Return a paginated list of stored submissions (admin use).
 * @param {{limit?: number, offset?: number, type?: string}} options
 * @returns {Promise<{total: number, rows: object[]}>}
 */
async function listSubmissions({ limit = 50, offset = 0, type = null } = {}) {
  await ensureSchema();

  const where = type ? 'WHERE form_type = ?' : '';
  const listArgs = type ? [type, limit, offset] : [limit, offset];

  const list = await getClient().execute({
    sql: `SELECT id, form_type, name, email, phone, subject, message, details, created_at
          FROM submissions
          ${where}
          ORDER BY datetime(created_at) DESC
          LIMIT ? OFFSET ?`,
    args: listArgs,
  });

  const count = await getClient().execute({
    sql: `SELECT COUNT(*) AS total FROM submissions ${where}`,
    args: type ? [type] : [],
  });

  return { total: Number(count.rows[0].total), rows: list.rows };
}

module.exports = {
  ensureSchema,
  saveSubmission,
  saveSubscriber,
  listSubmissions,
};
