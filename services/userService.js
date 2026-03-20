const admin = require('../config/firebase');

const COLLECTION = 'users';

const DEFAULT_USER = {
  wallet_gold: 500,
  wallet_gems: 50,
  difficulty_mode: 'normal',
  is_demo_mode: false,
  unlocked_breeds: ['golden_retriever'],
};

function normalizeUser(uid, data) {
  if (!data) return null;
  const out = { ...data, uid: data.uid || uid };
  if (out.createdAt && typeof out.createdAt.toDate === 'function') {
    out.createdAt = out.createdAt.toDate().toISOString();
  }
  if (out.updatedAt && typeof out.updatedAt.toDate === 'function') {
    out.updatedAt = out.updatedAt.toDate().toISOString();
  }
  return out;
}

async function upsertUser(userId, pseudo) {
  const db = admin.firestore();
  const ref = db.collection(COLLECTION).doc(userId);
  const snap = await ref.get();
  const trimmed = pseudo.trim();
  const base = {
    pseudo: trimmed,
    uid: userId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!snap.exists) {
    await ref.set({
      ...DEFAULT_USER,
      ...base,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await ref.set(base, { merge: true });
    const d = (await ref.get()).data();
    const patch = {};
    if (d.wallet_gold === undefined) patch.wallet_gold = DEFAULT_USER.wallet_gold;
    if (d.wallet_gems === undefined) patch.wallet_gems = DEFAULT_USER.wallet_gems;
    if (d.difficulty_mode === undefined) patch.difficulty_mode = DEFAULT_USER.difficulty_mode;
    if (d.is_demo_mode === undefined) patch.is_demo_mode = DEFAULT_USER.is_demo_mode;
    if (d.unlocked_breeds === undefined) patch.unlocked_breeds = [...DEFAULT_USER.unlocked_breeds];
    if (Object.keys(patch).length > 0) {
      await ref.set(patch, { merge: true });
    }
  }
  return { userId, pseudo: trimmed };
}

async function getUserById(userId) {
  if (!userId || typeof userId !== 'string') return null;
  const db = admin.firestore();
  const snap = await db.collection(COLLECTION).doc(userId.trim()).get();
  if (!snap.exists) return null;
  return normalizeUser(userId.trim(), snap.data());
}

async function getUserRawRef(tx, db, userId) {
  const ref = db.collection(COLLECTION).doc(userId.trim());
  const snap = tx ? await tx.get(ref) : await ref.get();
  return { ref, snap };
}

module.exports = {
  upsertUser,
  getUserById,
  getUserRawRef,
  normalizeUser,
  COLLECTION,
  DEFAULT_USER,
};
