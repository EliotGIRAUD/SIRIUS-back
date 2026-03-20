const admin = require('../config/firebase');

const DEFAULT_CHIEN = {
  hunger: 100,
  health: 100,
  wallet_soft_gold: 500,
  wallet_hard_gems: 50
};

async function initChien() {
  const db = admin.firestore();
  const chienRef = db.collection('chien').doc('chien');
  await chienRef.set(DEFAULT_CHIEN);
  return DEFAULT_CHIEN;
}

async function getChien() {
  const db = admin.firestore();
  const snap = await db.collection('chien').doc('chien').get();
  if (!snap.exists) return null;
  return snap.data();
}

module.exports = { initChien, getChien };
