'use strict';

/**
 * GET /api/trek-image?id=<n>
 * Serves an admin-uploaded trek image. Images are stored in the DB as data
 * URLs; this decodes and returns the raw bytes so the public cards can load
 * them with a lightweight <img src="/api/trek-image?id=..."> instead of
 * embedding large base64 blobs in the trek list JSON.
 */

const { getTrekById } = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const id = parseInt((req.query && req.query.id) || '', 10);
  if (!id) return res.status(400).json({ ok: false, error: 'A trek id is required.' });

  try {
    const trek = await getTrekById(id);
    const image = trek && trek.image;
    if (!image) return res.status(404).json({ ok: false, error: 'No image.' });

    // Plain URL → redirect to it.
    if (!/^data:/i.test(image)) {
      res.setHeader('Location', image);
      return res.status(302).end();
    }

    // data:<mime>;base64,<data>
    const match = /^data:([^;,]+);base64,(.*)$/i.exec(image);
    if (!match) return res.status(415).json({ ok: false, error: 'Unsupported image format.' });

    const mime = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('Failed to serve trek image:', (err && err.message) || err);
    return res.status(500).json({ ok: false, error: 'Failed to load image.' });
  }
};
