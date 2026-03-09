require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const subscribersRoutes = require('./routes/subscribers');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/subscribers', subscribersRoutes);

// Serve admin static files in production
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.get('/admin/*path', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
