const admin = require('../config/firebase');

const COLLECTION = 'inventory';

const DEFAULT_ITEMS = {
  croquettes: 2,
  water_bottle: 1,
};

function normalizeItems(items) {
  if (!items || typeof items !== 'object') return { ...DEFAULT_ITEMS };
  return {
    croquettes: Math.max(0, Number(items.croquettes) || 0),
    water_bottle: Math.max(0, Number(items.water_bottle) || 0),
  };
}

async function ensureInventory(ownerId) {
  const db = admin.firestore();
  const id = ownerId.trim();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (snap.exists) return;
  const now = admin.firestore.Timestamp.now();
  await ref.set({
    ownerId: id,
    items: { ...DEFAULT_ITEMS },
    createdAt: now,
    updatedAt: now,
  });
}

async function createInventory(ownerId) {
  await ensureInventory(ownerId);
  return getInventoryByOwner(ownerId);
}

async function getInventoryByOwner(ownerId) {
  if (!ownerId || typeof ownerId !== 'string') return null;
  const db = admin.firestore();
  const snap = await db.collection(COLLECTION).doc(ownerId.trim()).get();
  if (!snap.exists) return null;
  const d = snap.data();
  return {
    ownerId: d.ownerId || ownerId.trim(),
    items: normalizeItems(d.items),
  };
}

function inventoryRef(db, ownerId) {
  return db.collection(COLLECTION).doc(ownerId.trim());
}

module.exports = {
  createInventory,
  ensureInventory,
  getInventoryByOwner,
  inventoryRef,
  normalizeItems,
  DEFAULT_ITEMS,
  COLLECTION,
};
