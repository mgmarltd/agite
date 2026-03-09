const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/auth');
const { addToKlaviyo } = require('../services/klaviyo');

const router = express.Router();

// Public - subscribe with email
router.post('/', async (req, res) => {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    db.prepare('INSERT INTO subscribers (email) VALUES (?)').run(cleanEmail);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Email already subscribed' });
    }
    return res.status(500).json({ error: 'Failed to subscribe' });
  }

  // Send to Klaviyo (non-blocking - don't fail subscription if Klaviyo fails)
  addToKlaviyo(cleanEmail).then((result) => {
    if (!result.success) {
      console.error('Klaviyo sync failed:', result.error);
    }
  });

  res.json({ message: 'Subscribed successfully' });
});

// Protected - get all subscribers
router.get('/', authMiddleware, (req, res) => {
  const subscribers = db.prepare('SELECT id, email, created_at FROM subscribers ORDER BY created_at DESC').all();
  res.json(subscribers);
});

// Protected - delete subscriber
router.delete('/:id', authMiddleware, (req, res) => {
  const result = db.prepare('DELETE FROM subscribers WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Subscriber not found' });
  }
  res.json({ message: 'Subscriber deleted' });
});

// Protected - export as CSV
router.get('/export', authMiddleware, (req, res) => {
  const subscribers = db.prepare('SELECT email, created_at FROM subscribers ORDER BY created_at DESC').all();
  const csv = 'Email,Subscribed At\n' + subscribers.map(s => `${s.email},${s.created_at}`).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=subscribers.csv');
  res.send(csv);
});

module.exports = router;
