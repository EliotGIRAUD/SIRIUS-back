const admin = require('../config/firebase');
const dogService = require('./dogService');
const inventoryService = require('./inventoryService');
const userService = require('./userService');

function err(msg, status) {
  const e = new Error(msg);
  e.status = status;
  return e;
}

async function feedDog(userId, dogId) {
  const uid = typeof userId === 'string' ? userId.trim() : '';
  const did = typeof dogId === 'string' ? dogId.trim() : '';
  if (!uid) throw err('userId invalide', 400);
  if (!did) throw err('dogId requis', 400);

  const db = admin.firestore();
  const dRef = dogService.dogDocRef(db, did);
  const iRef = inventoryService.inventoryRef(db, uid);

  return db.runTransaction(async (tx) => {
    const [dSnap, iSnap] = await Promise.all([tx.get(dRef), tx.get(iRef)]);
    if (!dSnap.exists) throw err('Chien introuvable', 404);
    if (!iSnap.exists) throw err('Inventaire introuvable', 404);

    const dog = dSnap.data();
    if (dog.ownerId !== uid) throw err('Interdit', 403);

    const items = inventoryService.normalizeItems(iSnap.data().items);
    const n = Number(items.croquettes);
    const croquettes = Number.isFinite(n) ? n : 0;
    if (croquettes < 1) throw err('Pas de croquettes', 400);

    items.croquettes = croquettes - 1;
    const now = admin.firestore.Timestamp.now();

    tx.update(iRef, { items, updatedAt: now });
    tx.update(dRef, {
      food: dogService.MAX_STAT,
      last_update: now,
      updatedAt: now,
    });

    return {
      dogId: did,
      food: dogService.MAX_STAT,
      items,
    };
  });
}

async function giveWater(userId, dogId) {
  const uid = typeof userId === 'string' ? userId.trim() : '';
  const did = typeof dogId === 'string' ? dogId.trim() : '';
  if (!uid) throw err('userId invalide', 400);
  if (!did) throw err('dogId requis', 400);

  const db = admin.firestore();
  const dRef = dogService.dogDocRef(db, did);
  const iRef = inventoryService.inventoryRef(db, uid);

  return db.runTransaction(async (tx) => {
    const [dSnap, iSnap] = await Promise.all([tx.get(dRef), tx.get(iRef)]);
    if (!dSnap.exists) throw err('Chien introuvable', 404);
    if (!iSnap.exists) throw err('Inventaire introuvable', 404);

    const dog = dSnap.data();
    if (dog.ownerId !== uid) throw err('Interdit', 403);

    const items = inventoryService.normalizeItems(iSnap.data().items);
    const n = Number(items.water_bottle);
    const waterBottle = Number.isFinite(n) ? n : 0;
    if (waterBottle < 1) throw err("Pas d'eau", 400);

    items.water_bottle = waterBottle - 1;
    const now = admin.firestore.Timestamp.now();

    tx.update(iRef, { items, updatedAt: now });
    tx.update(dRef, {
      water: dogService.MAX_STAT,
      last_update: now,
      updatedAt: now,
    });

    return {
      dogId: did,
      water: dogService.MAX_STAT,
      items,
    };
  });
}

const CLEAN_GOLD_REWARD = 5;

async function cleanNeeds(userId) {
  const uid = typeof userId === 'string' ? userId.trim() : '';
  if (!uid) throw err('userId invalide', 400);

  const db = admin.firestore();
  const uRef = db.collection(userService.COLLECTION).doc(uid);

  return db.runTransaction(async (tx) => {
    const uSnap = await tx.get(uRef);
    if (!uSnap.exists) throw err('Utilisateur introuvable', 404);
    const u = uSnap.data();
    const gold = Number(u.wallet_gold);
    const safe = Number.isFinite(gold) ? gold : 0;
    const next = safe + CLEAN_GOLD_REWARD;
    tx.update(uRef, {
      wallet_gold: next,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
      wallet_gold: next,
      wallet_gold_delta: CLEAN_GOLD_REWARD,
    };
  });
}

async function validateWalk(ownerId, body = {}) {
  const uid = typeof ownerId === 'string' ? ownerId.trim() : '';
  if (!uid) throw err('ownerId invalide', 400);

  const distanceKm = Number(body.distanceKm != null ? body.distanceKm : body.distance);
  const durationSec = Number(body.durationSec != null ? body.durationSec : body.duration);

  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw err('distanceKm invalide', 400);
  }
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw err('durationSec invalide', 400);
  }

  const durationHours = durationSec / 3600;
  const speedKmh = distanceKm / durationHours;

  let goldCredit = 0;
  if (speedKmh < 15 && speedKmh > 0) {
    goldCredit = Math.floor(distanceKm * 8);
  }

  if (goldCredit <= 0) {
    return {
      speed_kmh: speedKmh,
      wallet_gold_delta: 0,
      wallet_gold: null,
    };
  }

  const db = admin.firestore();
  const uRef = db.collection(userService.COLLECTION).doc(uid);

  const out = await db.runTransaction(async (tx) => {
    const uSnap = await tx.get(uRef);
    if (!uSnap.exists) throw err('Utilisateur introuvable', 404);
    const u = uSnap.data();
    const g = Number(u.wallet_gold);
    const safe = Number.isFinite(g) ? g : 0;
    const next = safe + goldCredit;
    tx.update(uRef, {
      wallet_gold: next,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
      speed_kmh: speedKmh,
      wallet_gold_delta: goldCredit,
      wallet_gold: next,
    };
  });

  return out;
}

module.exports = { feedDog, giveWater, cleanNeeds, validateWalk, CLEAN_GOLD_REWARD };
