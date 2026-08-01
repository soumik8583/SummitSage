'use strict';

/**
 * Ad-hoc database query helper for Summit Sage (Turso / libSQL).
 *
 * Usage (from the project root):
 *   node scripts/query.js "SELECT * FROM treks"
 *   node scripts/query.js "SELECT id, name, email, created_at FROM admins"
 *   node scripts/query.js "SELECT COUNT(*) AS n FROM submissions"
 *
 * Reads TURSO_DATABASE_URL / TURSO_AUTH_TOKEN from .env. If those are blank it
 * falls back to the local SQLite file (file:data/local.db).
 */

require('dotenv').config();
const { createClient } = require('@libsql/client');

const sql = process.argv.slice(2).join(' ').trim();
if (!sql) {
  console.error('Usage: node scripts/query.js "SELECT * FROM treks"');
  process.exit(1);
}

const url = process.env.TURSO_DATABASE_URL || 'file:data/local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient(authToken ? { url, authToken } : { url });

client
  .execute(sql)
  .then((res) => {
    if (res.rows && res.rows.length) {
      // Print as a table; trim long values (e.g. base64 images) for readability.
      const rows = res.rows.map((r) => {
        const o = {};
        for (const k of Object.keys(r)) {
          const v = r[k];
          o[k] = typeof v === 'string' && v.length > 60 ? v.slice(0, 57) + '…' : v;
        }
        return o;
      });
      console.table(rows);
      console.log(`(${res.rows.length} row${res.rows.length === 1 ? '' : 's'})`);
    } else {
      console.log('OK.', res.rowsAffected != null ? `rowsAffected=${res.rowsAffected}` : '');
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('Query error:', err.message);
    process.exit(1);
  });
