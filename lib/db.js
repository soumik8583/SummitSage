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
        `CREATE TABLE IF NOT EXISTS trek_registrations (
          id                   INTEGER PRIMARY KEY AUTOINCREMENT,
          name                 TEXT    NOT NULL,
          email                TEXT    NOT NULL,
          phone                TEXT,
          people               INTEGER,
          city                 TEXT,
          tshirt_size          TEXT,
          emergency_contact    TEXT,
          trek                 TEXT,
          message              TEXT,
          source_submission_id INTEGER,
          ip_address           TEXT,
          user_agent           TEXT,
          created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
        );`,
        `CREATE TABLE IF NOT EXISTS audit_logs (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id   TEXT,
          admin_id     INTEGER,
          admin_name   TEXT,
          admin_email  TEXT,
          login_at     TEXT,
          logout_at    TEXT,
          updates      TEXT    NOT NULL DEFAULT '[]',
          created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
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
      await addColumn('ALTER TABLE admins ADD COLUMN is_super INTEGER NOT NULL DEFAULT 0');
      // Bootstrap: make sure at least one super admin exists (the founding
      // account — the earliest-created admin) so admin management can never be
      // locked out. Runs only when no super admin is present yet.
      try {
        await client.execute(
          `UPDATE admins SET is_super = 1
           WHERE id = (SELECT MIN(id) FROM admins)
             AND (SELECT COUNT(*) FROM admins WHERE is_super = 1) = 0`
        );
      } catch (e) {
        /* ignore — no admins yet, or column already handled */
      }
      // One-time, idempotent backfill: copy trek registrations that were
      // previously stored in the generic submissions table into the dedicated
      // trek_registrations table. The source_submission_id guard keeps it safe
      // to run on every cold start (never double-inserts).
      try {
        await client.execute(
          `INSERT INTO trek_registrations
             (name, email, phone, people, city, tshirt_size, emergency_contact, trek, message, source_submission_id, created_at)
           SELECT s.name, s.email, s.phone,
                  json_extract(s.details, '$.people'),
                  json_extract(s.details, '$.city'),
                  json_extract(s.details, '$.tShirtSize'),
                  json_extract(s.details, '$.emergencyContact'),
                  COALESCE(NULLIF(s.subject, ''), json_extract(s.details, '$.trek')),
                  s.message,
                  s.id,
                  s.created_at
           FROM submissions s
           WHERE s.form_type = 'registration'
             AND s.id NOT IN (
               SELECT source_submission_id FROM trek_registrations WHERE source_submission_id IS NOT NULL
             )`
        );
      } catch (e) {
        /* ignore — JSON functions unavailable or nothing to backfill */
      }
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

// Columns an admin is allowed to edit on a submission.
const SUBMISSION_EDIT_COLUMNS = ['form_type', 'name', 'email', 'phone', 'subject', 'message'];

/**
 * Update editable fields of a submission.
 * @param {number} id
 * @param {object} data partial map of editable columns.
 * @returns {Promise<{id:number, updated:number}>}
 */
async function updateSubmission(id, data) {
  await ensureSchema();
  const cols = SUBMISSION_EDIT_COLUMNS.filter(function (c) { return data[c] !== undefined; });
  if (cols.length === 0) return { id: id, updated: 0 };
  const set = cols.map(function (c) { return c + ' = ?'; }).join(', ');
  const args = cols.map(function (c) { return data[c]; });
  args.push(id);
  const res = await getClient().execute({
    sql: `UPDATE submissions SET ${set} WHERE id = ?`,
    args: args,
  });
  return { id: id, updated: Number(res.rowsAffected || 0) };
}

/**
 * Delete a submission by id.
 * @param {number} id
 */
async function deleteSubmission(id) {
  await ensureSchema();
  await getClient().execute({ sql: 'DELETE FROM submissions WHERE id = ?', args: [id] });
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

/**
 * Update editable fields of a subscriber (email, source).
 * @param {number} id
 * @param {{email?:string, source?:string}} data
 * @returns {Promise<{id:number, updated:number}>}
 */
async function updateSubscriber(id, data) {
  await ensureSchema();
  const cols = [];
  const args = [];
  if (data.email !== undefined) { cols.push('email = ?'); args.push(String(data.email).toLowerCase()); }
  if (data.source !== undefined) { cols.push('source = ?'); args.push(data.source || null); }
  if (cols.length === 0) return { id: id, updated: 0 };
  args.push(id);
  const res = await getClient().execute({
    sql: `UPDATE subscribers SET ${cols.join(', ')} WHERE id = ?`,
    args: args,
  });
  return { id: id, updated: Number(res.rowsAffected || 0) };
}

/**
 * Delete a subscriber by id.
 * @param {number} id
 */
async function deleteSubscriber(id) {
  await ensureSchema();
  await getClient().execute({ sql: 'DELETE FROM subscribers WHERE id = ?', args: [id] });
}

// ── Trek registrations (dedicated “User Registered Trek” table) ───────────────

const TREK_REG_EDIT_COLUMNS = [
  'name', 'email', 'phone', 'people', 'city', 'tshirt_size',
  'emergency_contact', 'trek', 'message',
];

/**
 * Persist a trek registration.
 * @param {object} data keyed by trek_registrations columns (snake_case).
 * @returns {Promise<{id:number, created_at:string}>}
 */
async function saveTrekRegistration(data) {
  await ensureSchema();
  const result = await getClient().execute({
    sql: `INSERT INTO trek_registrations
            (name, email, phone, people, city, tshirt_size, emergency_contact, trek, message, ip_address, user_agent)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.name,
      data.email,
      data.phone || null,
      data.people !== undefined && data.people !== null && data.people !== '' ? data.people : null,
      data.city || null,
      data.tshirt_size || null,
      data.emergency_contact || null,
      data.trek || null,
      data.message || null,
      data.ip_address || null,
      data.user_agent || null,
    ],
  });
  const id = Number(result.lastInsertRowid);
  const row = await getClient().execute({
    sql: 'SELECT created_at FROM trek_registrations WHERE id = ?',
    args: [id],
  });
  return { id, created_at: row.rows[0] ? row.rows[0].created_at : null };
}

/**
 * Return a paginated list of trek registrations (admin use).
 * @param {{limit?: number, offset?: number}} options
 * @returns {Promise<{total: number, rows: object[]}>}
 */
async function listTrekRegistrations({ limit = 200, offset = 0 } = {}) {
  await ensureSchema();
  const list = await getClient().execute({
    sql: `SELECT id, name, email, phone, people, city, tshirt_size, emergency_contact, trek, message, created_at
          FROM trek_registrations
          ORDER BY datetime(created_at) DESC
          LIMIT ? OFFSET ?`,
    args: [limit, offset],
  });
  const count = await getClient().execute(
    'SELECT COUNT(*) AS total FROM trek_registrations'
  );
  return { total: Number(count.rows[0].total), rows: list.rows };
}

/**
 * Update editable fields of a trek registration.
 * @param {number} id
 * @param {object} data partial map of editable columns.
 * @returns {Promise<{id:number, updated:number}>}
 */
async function updateTrekRegistration(id, data) {
  await ensureSchema();
  const cols = TREK_REG_EDIT_COLUMNS.filter(function (c) { return data[c] !== undefined; });
  if (cols.length === 0) return { id: id, updated: 0 };
  const set = cols.map(function (c) { return c + ' = ?'; }).join(', ');
  const args = cols.map(function (c) { return data[c]; });
  args.push(id);
  const res = await getClient().execute({
    sql: `UPDATE trek_registrations SET ${set} WHERE id = ?`,
    args: args,
  });
  return { id: id, updated: Number(res.rowsAffected || 0) };
}

/**
 * Delete a trek registration by id.
 * @param {number} id
 */
async function deleteTrekRegistration(id) {
  await ensureSchema();
  await getClient().execute({ sql: 'DELETE FROM trek_registrations WHERE id = ?', args: [id] });
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

  // Safety net: guarantee at least one super admin always exists by promoting
  // the very first admin account. On existing databases the ensureSchema
  // bootstrap already handles this; later signups stay non-super by default.
  try {
    if ((await countSuperAdmins()) === 0) {
      await getClient().execute({
        sql: 'UPDATE admins SET is_super = 1 WHERE id = ?',
        args: [id],
      });
    }
  } catch (e) {
    /* ignore — is_super column may be mid-migration */
  }

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
    sql: `SELECT id, name, email, password_hash, google_id, is_super, created_at
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
    sql: `SELECT id, name, email, password_hash, google_id, is_super, created_at
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
    `SELECT id, name, email, google_id, password_hash, is_super, created_at
     FROM admins
     ORDER BY datetime(created_at) DESC`
  );
  return res.rows;
}

/**
 * Update an admin's editable fields (name, email, password, super flag).
 * @param {number} id
 * @param {{name?:string, email?:string, password_hash?:string, is_super?:boolean|number}} data
 * @returns {Promise<{id:number, updated:number}>}
 */
async function updateAdmin(id, data) {
  await ensureSchema();
  const cols = [];
  const args = [];
  if (data.name !== undefined) { cols.push('name = ?'); args.push(data.name); }
  if (data.email !== undefined) { cols.push('email = ?'); args.push(String(data.email).toLowerCase()); }
  if (data.password_hash !== undefined) { cols.push('password_hash = ?'); args.push(data.password_hash); }
  if (data.is_super !== undefined) { cols.push('is_super = ?'); args.push(data.is_super ? 1 : 0); }
  if (cols.length === 0) return { id: id, updated: 0 };
  args.push(id);
  const res = await getClient().execute({
    sql: `UPDATE admins SET ${cols.join(', ')} WHERE id = ?`,
    args: args,
  });
  return { id: id, updated: Number(res.rowsAffected || 0) };
}

/**
 * Delete an admin by id.
 * @param {number} id
 */
async function deleteAdmin(id) {
  await ensureSchema();
  await getClient().execute({ sql: 'DELETE FROM admins WHERE id = ?', args: [id] });
}

/**
 * Count how many admins currently hold super-admin rights.
 * @returns {Promise<number>}
 */
async function countSuperAdmins() {
  await ensureSchema();
  const res = await getClient().execute('SELECT COUNT(*) AS n FROM admins WHERE is_super = 1');
  return Number(res.rows[0].n);
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

// ── Audit logs (admin activity — super-admin visibility) ─────────────────────

/**
 * Open an audit session when an admin signs in. One row per login session,
 * later completed with a logout time and a list of updates the admin made.
 * @param {{sessionId:string, admin:{id?:number, name?:string, email?:string}}} data
 */
async function createAuditSession({ sessionId, admin }) {
  await ensureSchema();
  await getClient().execute({
    sql: `INSERT INTO audit_logs (session_id, admin_id, admin_name, admin_email, login_at, updates)
          VALUES (?, ?, ?, ?, datetime('now'), '[]')`,
    args: [sessionId, admin.id != null ? admin.id : null, admin.name || null, admin.email || null],
  });
}

/**
 * Mark the logout time for an audit session (idempotent — only the first
 * logout/idle-timeout wins).
 * @param {string} sessionId
 */
async function closeAuditSession(sessionId) {
  await ensureSchema();
  if (!sessionId) return;
  await getClient().execute({
    sql: `UPDATE audit_logs SET logout_at = datetime('now')
          WHERE session_id = ? AND logout_at IS NULL`,
    args: [sessionId],
  });
}

/**
 * Append an update description (e.g. "Added trek …") to an audit session's
 * running list of changes.
 * @param {string} sessionId
 * @param {string} description
 */
async function appendAuditUpdate(sessionId, description) {
  await ensureSchema();
  if (!sessionId || !description) return;
  await getClient().execute({
    sql: `UPDATE audit_logs
          SET updates = json_insert(COALESCE(updates, '[]'), '$[#]', ?)
          WHERE session_id = ?`,
    args: [description, sessionId],
  });
}

/**
 * List audit-log rows (newest first) for the super-admin audit view.
 * @param {{limit?: number, offset?: number}} options
 * @returns {Promise<{total: number, rows: object[]}>}
 */
async function listAuditLogs({ limit = 200, offset = 0 } = {}) {
  await ensureSchema();
  const list = await getClient().execute({
    sql: `SELECT id, session_id, admin_id, admin_name, admin_email, login_at, logout_at, updates, created_at
          FROM audit_logs
          ORDER BY datetime(COALESCE(login_at, created_at)) DESC
          LIMIT ? OFFSET ?`,
    args: [limit, offset],
  });
  const count = await getClient().execute('SELECT COUNT(*) AS total FROM audit_logs');
  return { total: Number(count.rows[0].total), rows: list.rows };
}

module.exports = {
  ensureSchema,
  saveSubmission,
  saveSubscriber,
  listSubmissions,
  updateSubmission,
  deleteSubmission,
  listSubscribers,
  updateSubscriber,
  deleteSubscriber,
  saveTrekRegistration,
  listTrekRegistrations,
  updateTrekRegistration,
  deleteTrekRegistration,
  createAdmin,
  getAdminByEmail,
  getAdminById,
  setAdminGoogleId,
  listAdmins,
  updateAdmin,
  deleteAdmin,
  countSuperAdmins,
  createTrek,
  listTreks,
  getTrekById,
  updateTrek,
  deleteTrek,
  createAuditSession,
  closeAuditSession,
  appendAuditUpdate,
  listAuditLogs,
};
