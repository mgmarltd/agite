const express = require('express');
const crypto = require('crypto');
const db = require('../database');
const authMiddleware = require('../middleware/auth');
const { addToKlaviyo } = require('../services/klaviyo');
const { sendVerificationEmail } = require('../services/email');

const router = express.Router();

// Public - subscribe with email (sends verification email)
router.post('/', async (req, res) => {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const cleanEmail = email.toLowerCase().trim();

  // Check if already a confirmed subscriber
  const existing = db.prepare('SELECT id FROM subscribers WHERE email = ?').get(cleanEmail);
  if (existing) {
    return res.status(409).json({ error: 'Email already subscribed' });
  }

  // Generate verification token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  // Upsert into pending_subscribers (replace if they request again)
  try {
    db.prepare(`
      INSERT INTO pending_subscribers (email, token, expires_at)
      VALUES (?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at
    `).run(cleanEmail, token, expiresAt);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to process subscription' });
  }

  // Send verification email
  const result = await sendVerificationEmail(cleanEmail, token);
  if (!result.success) {
    console.error('Failed to send verification email:', result.error);
    return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
  }

  res.json({ message: 'Verification email sent! Please check your inbox.' });
});

// Public - verify email and confirm subscription
router.get('/verify/:token', async (req, res) => {
  const { token } = req.params;

  const pending = db.prepare('SELECT * FROM pending_subscribers WHERE token = ?').get(token);

  if (!pending) {
    return res.send(buildConfirmPage(false, 'Invalid or expired verification link.'));
  }

  if (new Date(pending.expires_at) < new Date()) {
    db.prepare('DELETE FROM pending_subscribers WHERE id = ?').run(pending.id);
    return res.send(buildConfirmPage(false, 'This verification link has expired. Please subscribe again.'));
  }

  // Move to confirmed subscribers
  try {
    db.prepare('INSERT INTO subscribers (email) VALUES (?)').run(pending.email);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      db.prepare('DELETE FROM pending_subscribers WHERE id = ?').run(pending.id);
      return res.send(buildConfirmPage(true, 'Your email is already confirmed!'));
    }
    return res.send(buildConfirmPage(false, 'Something went wrong. Please try again.'));
  }

  // Remove from pending
  db.prepare('DELETE FROM pending_subscribers WHERE id = ?').run(pending.id);

  // Send to Klaviyo (non-blocking)
  addToKlaviyo(pending.email).then((result) => {
    if (!result.success) {
      console.error('Klaviyo sync failed:', result.error);
    }
  });

  res.send(buildConfirmPage(true, "You're in! Your email has been confirmed."));
});

function buildConfirmPage(success, message) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${success ? 'Confirmed' : 'Error'} - AGIT\u00C9</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #000;
    color: #fff;
    font-family: Arial, Helvetica, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    text-align: center;
    padding: 20px;
  }
  .container { max-width: 500px; }
  .logo { font-size: 48px; font-weight: 900; letter-spacing: 4px; margin-bottom: 40px; font-style: italic; }
  .icon { font-size: 48px; margin-bottom: 24px; }
  h1 { font-size: 24px; font-weight: 800; letter-spacing: 1px; margin-bottom: 16px; }
  p { color: #999; font-size: 14px; line-height: 1.6; }
  .btn {
    display: inline-block;
    margin-top: 32px;
    background: #fff;
    color: #000;
    text-decoration: none;
    padding: 14px 32px;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 1px;
  }
</style>
</head>
<body>
<div class="container">
  <div class="logo">AGIT\u00C9</div>
  <div class="icon">${success ? '\u2713' : '\u2717'}</div>
  <h1>${success ? "YOU'RE IN" : 'OOPS'}</h1>
  <p>${message}</p>
  <a href="/" class="btn">GO TO SITE</a>
</div>
</body>
</html>`;
}

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
