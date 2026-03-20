require('dotenv').config();
const express = require('express');
const cors = require('cors');
require('./config/firebase');
const dogRoutes = require('./routes/dogRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/', dogRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
