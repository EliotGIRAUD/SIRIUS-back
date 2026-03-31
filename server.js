require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
require('./config/firebase');
const authRoutes = require('./routes/authRoutes');
const dogRoutes = require('./routes/dogRoutes');
const shopRoutes = require('./routes/shopRoutes');
const interactRoutes = require('./routes/interactRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

/**
 * CORS : pour le prototype, on autorise toutes les origines (Expo Go, émulateurs, origine null sur mobile, localhost Web).
 * En production, restreindre via la variable CORS_ORIGINS (liste séparée par des virgules).
 */
const corsList = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : null;

app.use(
  cors({
    origin(origin, callback) {
      if (corsList && corsList.length) {
        if (!origin || corsList.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed by CORS'));
        return;
      }
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use('/', authRoutes);
app.use('/', dogRoutes);
app.use('/', shopRoutes);
app.use('/', interactRoutes);
app.use('/', userRoutes);

const PORT = Number(process.env.PORT) || 3001;
const server = http.createServer(app);
server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} déjà utilisé (autre instance du serveur ?).`);
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
