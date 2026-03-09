const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const admin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const validPassword = bcrypt.compareSync(password, admin.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, username: admin.username });
});

router.post('/change-password', require('../middleware/auth'), (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const admin = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.admin.id);
  const validPassword = bcrypt.compareSync(currentPassword, admin.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admin_users SET password = ? WHERE id = ?').run(hashedPassword, req.admin.id);

  res.json({ message: 'Password updated successfully' });
});

module.exports = router;
