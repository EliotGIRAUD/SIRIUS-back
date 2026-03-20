const admin = require('../config/firebase');

const COLLECTION = 'users';

/**
 * Crée ou met à jour le profil minimal du compte : pseudo affiché pour l’utilisateur.
 * Document Firestore : users/{userId}
 */
async function upsertUser(userId, pseudo) {
  const db = admin.firestore();
  const ref = db.collection(COLLECTION).doc(userId);
  const snap = await ref.get();
  const trimmed = pseudo.trim();
  const payload = {
    pseudo: trimmed,
    userId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!snap.exists) {
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }
  await ref.set(payload, { merge: true });
  return { userId, pseudo: trimmed };
}

/**
 * Lit users/{userId} ; renvoie null si absent.
 */
async function getUserById(userId) {
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

module.exports = { upsertUser, getUserById, COLLECTION };
