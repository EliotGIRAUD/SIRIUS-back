const admin = require('../config/firebase');

const COLLECTION = 'chiens';

/**
 * Valeurs par défaut du chien après initialisation (Jalon 1).
 * Le front dashboard peut afficher : faim → hunger, santé → health, or → wallet_soft_gold, gemmes → wallet_hard_gems.
 */
const DEFAULT_CHIEN = {
  hunger: 100,
  health: 100,
  maladie: 0,
  wallet_soft_gold: 500,
  wallet_hard_gems: 50,
  race: '',
};

/**
 * Crée ou écrase le document Firestore chiens/{userId}.
 * Attendu dans le body : name (nom affiché), userId (identifiant — ex. uid renvoyé par POST /auth/login).
 * Optionnel : race (ex. "Golden Retriever").
 */
async function initChien(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  if (!name || !userId) {
    const err = new Error('Champs requis : name et userId');
    err.status = 400;
    throw err;
  }

  const race = typeof body.race === 'string' ? body.race.trim() : '';

  const payload = {
    ...DEFAULT_CHIEN,
    userId,
    name,
    race,
    nom: name,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const db = admin.firestore();
  const ref = db.collection(COLLECTION).doc(userId);
  await ref.set({
    ...payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const plain = { ...payload };
  delete plain.updatedAt;
  delete plain.createdAt;
  return plain;
}

/**
 * Lit chiens/{userId} et renvoie les données brutes (timestamps convertis en objets si besoin côté lecture sérialisée).
 */
async function getChienByUserId(userId) {
  if (!userId || typeof userId !== 'string') return null;
  const db = admin.firestore();
  const snap = await db.collection(COLLECTION).doc(userId.trim()).get();
  if (!snap.exists) return null;
  const data = snap.data();
  const out = { ...data };
  if (out.createdAt && typeof out.createdAt.toDate === 'function') {
    out.createdAt = out.createdAt.toDate().toISOString();
  }
  if (out.updatedAt && typeof out.updatedAt.toDate === 'function') {
    out.updatedAt = out.updatedAt.toDate().toISOString();
  }
  return out;
}

module.exports = { initChien, getChienByUserId, COLLECTION };
