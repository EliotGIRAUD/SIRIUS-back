require('dotenv').config();
const path = require('path');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const credentialsPath = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: process.env.DATABASE_URL
  });
}

module.exports = admin;
