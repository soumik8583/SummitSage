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
const trekImageHandler = require('./api/trek-image');
const adminActionHandler = require('./api/admin/[action].js');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
// Larger limit so admins can upload trek images (base64 data URLs).
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true, limit: '6mb' }));

// ── API routes (delegated to the Vercel-style handlers) ───────────────
app.post('/api/contact', (req, res) => contactHandler(req, res));
app.post('/api/subscribe', (req, res) => subscribeHandler(req, res));
app.all('/api/submissions', (req, res) => submissionsHandler(req, res));
app.get('/api/health', (req, res) => healthHandler(req, res));
app.all('/api/subscribers', (req, res) => subscribersHandler(req, res));
app.all('/api/admins', (req, res) => adminsHandler(req, res));
app.get('/api/treks', (req, res) => treksHandler(req, res));
app.get('/api/trek-image', (req, res) => trekImageHandler(req, res));

// ── Admin API routes (single consolidated function, routed by :action) ─
app.all('/api/admin/:action', (req, res) => {
  req.query = Object.assign({}, req.query, { action: req.params.action });
  adminActionHandler(req, res);
});

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
