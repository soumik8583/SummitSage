'use strict';

/**
 * GET /api/health
 * Lightweight health check.
 */

module.exports = (req, res) => {
  res.json({ ok: true, status: 'healthy', timestamp: new Date().toISOString() });
};
