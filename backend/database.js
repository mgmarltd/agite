const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'agite.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default admin user if none exists
const adminExists = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
  db.prepare('INSERT INTO admin_users (username, password) VALUES (?, ?)').run('admin', hashedPassword);
}

// Seed default settings if none exist
const deadlineExists = db.prepare("SELECT id FROM settings WHERE key = ?").get('deadline');
if (!deadlineExists) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('deadline', '2026-03-28T17:30:00.000Z');
}

const dropTitleExists = db.prepare("SELECT id FROM settings WHERE key = ?").get('drop_title');
if (!dropTitleExists) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('drop_title', 'DROP 01 | MARCH 28, 2026');
}

const earlyAccessExists = db.prepare("SELECT id FROM settings WHERE key = ?").get('early_access_text');
if (!earlyAccessExists) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('early_access_text', 'JOIN WAITLIST FOR EARLY ACCESS');
}

const bottomTitleExists = db.prepare("SELECT id FROM settings WHERE key = ?").get('bottom_title');
if (!bottomTitleExists) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('bottom_title', 'Chance auf Early Access');
}

const bottomDescExists = db.prepare("SELECT id FROM settings WHERE key = ?").get('bottom_description');
if (!bottomDescExists) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('bottom_description', 'Trage dich jetzt in die OT-Warteliste ein, um eine Chance auf Early Access zu erhalten und somit früher in den Shop zu können. Wir benachrichtigen dich kurz vorm Drop.');
}

const collectionUrlExists = db.prepare("SELECT id FROM settings WHERE key = ?").get('collection_url');
if (!collectionUrlExists) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('collection_url', '#');
}

module.exports = db;
