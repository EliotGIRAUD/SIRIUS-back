require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
require('./config/firebase');
const dogRoutes = require('./routes/dogRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/', dogRoutes);

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
