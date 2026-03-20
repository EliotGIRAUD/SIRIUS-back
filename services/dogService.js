const admin = require('../config/firebase');

const DEFAULT_CHIEN = {
  hunger: 100,
  health: 100,
  maladie: 0,
  wallet_soft_gold: 500,
  wallet_hard_gems: 50,
  nom: '',
  race: '',
};

async function initChien(body = {}) {
  const nom = typeof body.nom === 'string' ? body.nom : '';
  const race = typeof body.race === 'string' ? body.race : '';
  const payload = {
    ...DEFAULT_CHIEN,
    nom,
    race,
  };
  const db = admin.firestore();
  const chienRef = db.collection('chien').doc('chien');
  await chienRef.set(payload);
  return payload;
}

async function getChien() {
  const db = admin.firestore();
  const snap = await db.collection('chien').doc('chien').get();
  if (!snap.exists) return null;
  return snap.data();
}

module.exports = { initChien, getChien };
