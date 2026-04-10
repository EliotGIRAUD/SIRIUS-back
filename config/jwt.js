require('dotenv').config();
const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET || 'sirius-dev-change-in-prod';

function signToken(uid) {
  return jwt.sign({ sub: uid }, secret, { expiresIn: '30d' });
}

function verifyToken(token) {
  return jwt.verify(token, secret);
}

module.exports = { signToken, verifyToken };
