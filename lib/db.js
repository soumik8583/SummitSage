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
    schemaReady = (async function () {
      const statements = [
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
        `CREATE TABLE IF NOT EXISTS admins (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          name          TEXT    NOT NULL,
          email         TEXT    NOT NULL UNIQUE,
          password_hash TEXT,
          google_id     TEXT,
          created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );`,
        `CREATE TABLE IF NOT EXISTS treks (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          slug          TEXT    NOT NULL UNIQUE,
          name          TEXT    NOT NULL,
          region        TEXT,
          base          TEXT,
          difficulty    TEXT,
          season        TEXT,
          days          INTEGER,
          distance_km   INTEGER,
          max_altitude  INTEGER,
          price         INTEGER,
          early_bird    INTEGER,
          total_seats   INTEGER,
          seats_left    INTEGER,
          start_date    TEXT,
          rating        REAL,
          image         TEXT,
          tags          TEXT,
          blurb         TEXT,
          description   TEXT,
          highlights    TEXT,
          active        INTEGER NOT NULL DEFAULT 1,
          created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );`,
      ];
      const client = getClient();
      await client.batch(statements, 'write');
      // Idempotent migrations — add columns that may be missing on older DBs.
      const addColumn = async function (sql) {
        try {
          await client.execute(sql);
        } catch (e) {
          /* column already exists — ignore */
        }
      };
      await addColumn('ALTER TABLE treks ADD COLUMN end_date TEXT');
    })();
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

/**
 * Return a paginated list of newsletter subscribers (admin use).
 * @param {{limit?: number, offset?: number}} options
 * @returns {Promise<{total: number, rows: object[]}>}
 */
async function listSubscribers({ limit = 200, offset = 0 } = {}) {
  await ensureSchema();

  const list = await getClient().execute({
    sql: `SELECT id, email, source, created_at
          FROM subscribers
          ORDER BY datetime(created_at) DESC
          LIMIT ? OFFSET ?`,
    args: [limit, offset],
  });

  const count = await getClient().execute(
    'SELECT COUNT(*) AS total FROM subscribers'
  );

  return { total: Number(count.rows[0].total), rows: list.rows };
}

// ── Admins ───────────────────────────────────────────────────────────────────

/**
 * Create an admin account.
 * @param {{name:string, email:string, password_hash?:string|null, google_id?:string|null}} data
 * @returns {Promise<{id:number, created_at:string}>}
 */
async function createAdmin(data) {
  await ensureSchema();

  const result = await getClient().execute({
    sql: `INSERT INTO admins (name, email, password_hash, google_id)
          VALUES (?, ?, ?, ?)`,
    args: [
      data.name,
      String(data.email).toLowerCase(),
      data.password_hash || null,
      data.google_id || null,
    ],
  });

  const id = Number(result.lastInsertRowid);
  const row = await getClient().execute({
    sql: 'SELECT created_at FROM admins WHERE id = ?',
    args: [id],
  });

  return { id, created_at: row.rows[0] ? row.rows[0].created_at : null };
}

/**
 * Look up an admin by email (case-insensitive).
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function getAdminByEmail(email) {
  await ensureSchema();
  const res = await getClient().execute({
    sql: `SELECT id, name, email, password_hash, google_id, created_at
          FROM admins WHERE email = ?`,
    args: [String(email).toLowerCase()],
  });
  return res.rows[0] || null;
}

/**
 * Look up an admin by id.
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function getAdminById(id) {
  await ensureSchema();
  const res = await getClient().execute({
    sql: `SELECT id, name, email, password_hash, google_id, created_at
          FROM admins WHERE id = ?`,
    args: [id],
  });
  return res.rows[0] || null;
}

/**
 * Link a Google account id to an existing admin.
 * @param {number} id
 * @param {string} googleId
 */
async function setAdminGoogleId(id, googleId) {
  await ensureSchema();
  await getClient().execute({
    sql: 'UPDATE admins SET google_id = ? WHERE id = ?',
    args: [googleId, id],
  });
}

/**
 * List all admin accounts (admin use). Includes password_hash/google_id so
 * callers can derive the sign-in method; never send password_hash to clients.
 * @returns {Promise<object[]>}
 */
async function listAdmins() {
  await ensureSchema();
  const res = await getClient().execute(
    `SELECT id, name, email, google_id, password_hash, created_at
     FROM admins
     ORDER BY datetime(created_at) DESC`
  );
  return res.rows;
}

// ── Treks (admin-managed catalogue) ──────────────────────────────────────────

const TREK_COLUMNS = [
  'slug', 'name', 'region', 'base', 'difficulty', 'season', 'days',
  'distance_km', 'max_altitude', 'price', 'early_bird', 'total_seats',
  'seats_left', 'start_date', 'end_date', 'rating', 'image', 'tags', 'blurb',
  'description', 'highlights', 'active',
];

/**
 * Create a trek.
 * @param {object} data keyed by the trek columns (snake_case).
 * @returns {Promise<{id:number, slug:string}>}
 */
async function createTrek(data) {
  await ensureSchema();

  const cols = TREK_COLUMNS;
  const placeholders = cols.map(function () { return '?'; }).join(', ');
  const args = cols.map(function (c) {
    const v = data[c];
    return v === undefined ? null : v;
  });

  const result = await getClient().execute({
    sql: `INSERT INTO treks (${cols.join(', ')}) VALUES (${placeholders})`,
    args: args,
  });

  return { id: Number(result.lastInsertRowid), slug: data.slug };
}

/**
 * List treks.
 * @param {{activeOnly?: boolean}} options
 * @returns {Promise<object[]>}
 */
async function listTreks({ activeOnly = false } = {}) {
  await ensureSchema();
  const where = activeOnly ? 'WHERE active = 1' : '';
  const res = await getClient().execute(
    `SELECT * FROM treks ${where} ORDER BY datetime(created_at) DESC`
  );
  return res.rows;
}

/**
 * Fetch a single trek by id.
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function getTrekById(id) {
  await ensureSchema();
  const res = await getClient().execute({
    sql: 'SELECT * FROM treks WHERE id = ?',
    args: [id],
  });
  return res.rows[0] || null;
}

/**
 * Update the given columns of a trek.
 * @param {number} id
 * @param {object} data partial map of trek columns (snake_case).
 * @returns {Promise<{id:number, updated:number}>}
 */
async function updateTrek(id, data) {
  await ensureSchema();
  const cols = TREK_COLUMNS.filter(function (c) { return data[c] !== undefined; });
  if (cols.length === 0) return { id: id, updated: 0 };
  const set = cols.map(function (c) { return c + ' = ?'; }).join(', ');
  const args = cols.map(function (c) { return data[c]; });
  args.push(id);
  const res = await getClient().execute({
    sql: `UPDATE treks SET ${set} WHERE id = ?`,
    args: args,
  });
  return { id: id, updated: Number(res.rowsAffected || 0) };
}

/**
 * Delete a trek by id.
 * @param {number} id
 */
async function deleteTrek(id) {
  await ensureSchema();
  await getClient().execute({ sql: 'DELETE FROM treks WHERE id = ?', args: [id] });
}

module.exports = {
  ensureSchema,
  saveSubmission,
  saveSubscriber,
  listSubmissions,
  listSubscribers,
  createAdmin,
  getAdminByEmail,
  getAdminById,
  setAdminGoogleId,
  listAdmins,
  createTrek,
  listTreks,
  getTrekById,
  updateTrek,
  deleteTrek,
};
