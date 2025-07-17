require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'syncify-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

const authRoutes = require('./routes/auth');
const playlistRoutes = require('./routes/playlists');
const syncRoutes = require('./routes/sync');
const servicesRoutes = require('./routes/services');

app.use('/auth', authRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/services', servicesRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
  res.json({
    spotify: req.session.spotifyTokens ? 'connected' : 'disconnected',
    apple: req.session.appleUserToken ? 'connected' : 'disconnected',
    appleAuth: req.session.appleAuth ? {
      signedIn: true,
      email: req.session.appleAuth.email,
      isPrivateEmail: req.session.appleAuth.isPrivateEmail
    } : null
  });
});

app.listen(PORT, () => {
  console.log(`Syncify server running on http://127.0.0.1:${PORT}`);
});