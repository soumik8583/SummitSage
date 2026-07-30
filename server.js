'use strict';

/**
 * Local development server for Summit Sage.
 *
 * In production the site is deployed to Vercel, where the files in /api
 * run as Serverless Functions and /public is served as static assets.
 *
 * This Express server exists purely so you can run the exact same API
 * handlers locally with `npm run dev` (or `npm start`) without needing
 * the Vercel CLI. It mounts the same handler files Vercel uses.
 */

require('dotenv').config();

const path = require('path');
const express = require('express');

// The same handlers Vercel runs as Serverless Functions.
const contactHandler = require('./api/contact');
const subscribeHandler = require('./api/subscribe');
const submissionsHandler = require('./api/submissions');
const healthHandler = require('./api/health');
const subscribersHandler = require('./api/subscribers');
const adminsHandler = require('./api/admins');
const treksHandler = require('./api/treks');
const adminTreksHandler = require('./api/admin/treks');
const adminSignupHandler = require('./api/admin/signup');
const adminLoginHandler = require('./api/admin/login');
const adminGoogleHandler = require('./api/admin/google');
const adminSessionHandler = require('./api/admin/session');
const adminConfigHandler = require('./api/admin/config');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: true, limit: '20kb' }));

// ── API routes (delegated to the Vercel-style handlers) ───────────────
app.post('/api/contact', (req, res) => contactHandler(req, res));
app.post('/api/subscribe', (req, res) => subscribeHandler(req, res));
app.get('/api/submissions', (req, res) => submissionsHandler(req, res));
app.get('/api/health', (req, res) => healthHandler(req, res));
app.get('/api/subscribers', (req, res) => subscribersHandler(req, res));
app.get('/api/admins', (req, res) => adminsHandler(req, res));
app.get('/api/treks', (req, res) => treksHandler(req, res));

// ── Admin API routes ──────────────────────────────────────────────────
app.post('/api/admin/signup', (req, res) => adminSignupHandler(req, res));
app.post('/api/admin/login', (req, res) => adminLoginHandler(req, res));
app.post('/api/admin/google', (req, res) => adminGoogleHandler(req, res));
app.get('/api/admin/session', (req, res) => adminSessionHandler(req, res));
app.get('/api/admin/config', (req, res) => adminConfigHandler(req, res));
app.all('/api/admin/treks', (req, res) => adminTreksHandler(req, res));

// ── Static website (serves /page for /page.html, matching Vercel cleanUrls) ─
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// ── Fallback: unknown non-API routes → homepage ───────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'Not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('\n  ⛰   Summit Sage (local dev)');
  console.log(`  ➜   Local:   http://localhost:${PORT}\n`);
});
