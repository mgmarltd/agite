const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const PRIVATE_KEYS = ['klaviyo_api_key', 'klaviyo_list_id'];

// Public route - get all settings for the frontend (excludes private keys)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(row => {
    if (!PRIVATE_KEYS.includes(row.key)) {
      settings[row.key] = row.value;
    }
  });
  res.json(settings);
});

// Protected route - get all settings including private keys
router.get('/all', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(row => {
    settings[row.key] = row.value;
  });
  res.json(settings);
});

// Protected route - update settings
router.put('/', authMiddleware, (req, res) => {
  const updates = req.body;

  const updateStmt = db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  );

  const updateMany = db.transaction((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      updateStmt.run(key, String(value));
    }
  });

  try {
    updateMany(updates);
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Protected route - test Klaviyo connection
router.post('/klaviyo-test', authMiddleware, async (req, res) => {
  const { getKlaviyoSettings } = require('../services/klaviyo');
  const { apiKey, listId } = getKlaviyoSettings();

  if (!apiKey || !listId) {
    return res.status(400).json({ error: 'Klaviyo API Key and List ID are required. Save them first.' });
  }

  try {
    // Test by fetching the list
    const listRes = await fetch(`https://a.klaviyo.com/api/lists/${listId}`, {
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: '2024-10-15',
      },
    });

    if (listRes.ok) {
      const data = await listRes.json();
      const listName = data?.data?.attributes?.name || 'Unknown';
      return res.json({ message: `Connected! List: "${listName}"` });
    }

    if (listRes.status === 401) {
      return res.status(400).json({ error: 'Invalid API Key' });
    }
    if (listRes.status === 404) {
      return res.status(400).json({ error: 'List ID not found' });
    }

    return res.status(400).json({ error: `Klaviyo returned status ${listRes.status}` });
  } catch (err) {
    return res.status(500).json({ error: 'Connection failed: ' + err.message });
  }
});

module.exports = router;
