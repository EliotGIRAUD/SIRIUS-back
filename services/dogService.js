const admin = require('../config/firebase');
const userService = require('./userService');
const inventoryService = require('./inventoryService');

const COLLECTION = 'dogs';

const MAX_STAT = 100;

function dogDocRef(db, dogId) {
  return db.collection(COLLECTION).doc(dogId.trim());
}

/**
 * Nourriture / eau : 100 = plein, diminue avec le temps (plus 0 = affamé / assoiffé).
 * Lecture tolérante : anciens docs `hunger` / `thirst`.
 */
function readFood(dog) {
  const v = Number(dog.food != null ? dog.food : dog.hunger);
  return Number.isFinite(v) ? v : MAX_STAT;
}

function readWater(dog) {
  const v = Number(dog.water != null ? dog.water : dog.thirst);
  return Number.isFinite(v) ? v : MAX_STAT;
}

function applyTickToStats(dog, user, nowTs) {
  let food = readFood(dog);
  let water = readWater(dog);
  let health = Number(dog.health);
  if (!Number.isFinite(health)) health = MAX_STAT;

  const last = dog.last_update;
  const nowMs = nowTs.toMillis();
  const lastMs = last && typeof last.toMillis === 'function' ? last.toMillis() : nowMs;
  const deltaMs = Math.max(0, nowMs - lastMs);

  const isDemo = user.is_demo_mode === true;
  let foodLoss = 0;
  let waterLoss = 0;

  if (isDemo) {
    const steps = Math.floor(deltaMs / 10000);
    foodLoss = steps;
    waterLoss = steps;
  } else {
    const hours = deltaMs / (1000 * 60 * 60);
    const rate = user.difficulty_mode === 'hardcore' ? 2 : 1;
    const loss = Math.floor(hours * rate);
    foodLoss = loss;
    waterLoss = loss;
  }

  food = Math.max(0, food - foodLoss);
  water = Math.max(0, water - waterLoss);

  if (food === 0 || water === 0) {
    const penalty = Math.max(foodLoss, waterLoss, 1);
    health = Math.max(0, health - penalty);
  }

  const is_sick = health < 50;

  return {
    food,
    water,
    health,
    is_sick,
    last_update: nowTs,
  };
}

function serializeDog(id, data) {
  if (!data) return null;
  const o = { ...data, id };
  if (o.last_update && typeof o.last_update.toDate === 'function') {
    o.last_update = o.last_update.toDate().toISOString();
  }
  if (o.createdAt && typeof o.createdAt.toDate === 'function') {
    o.createdAt = o.createdAt.toDate().toISOString();
  }
  if (o.updatedAt && typeof o.updatedAt.toDate === 'function') {
    o.updatedAt = o.updatedAt.toDate().toISOString();
  }
  if (o.abandonment_marked_at && typeof o.abandonment_marked_at.toDate === 'function') {
    o.abandonment_marked_at = o.abandonment_marked_at.toDate().toISOString();
  }
  return o;
}

async function initDog(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  if (!name || !userId) {
    const err = new Error('Champs requis : name et userId');
    err.status = 400;
    throw err;
  }

  const db = admin.firestore();
  const uSnap = await db.collection(userService.COLLECTION).doc(userId).get();
  if (!uSnap.exists) {
    const err = new Error('Utilisateur introuvable');
    err.status = 404;
    throw err;
  }

  const breed =
    typeof body.breed === 'string'
      ? body.breed.trim()
      : typeof body.race === 'string'
        ? body.race.trim()
        : '';

  const now = admin.firestore.Timestamp.now();
  const ref = db.collection(COLLECTION).doc();
  const dogId = ref.id;

  const dogPayload = {
    ownerId: userId,
    name,
    breed: breed || 'golden_retriever',
    food: MAX_STAT,
    water: MAX_STAT,
    health: MAX_STAT,
    is_sick: false,
    last_update: now,
    abandonment_pending_video: false,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(dogPayload);
  await inventoryService.ensureInventory(userId);

  return serializeDog(dogId, { ...dogPayload });
}

async function listDogsForUser(userId) {
  const db = admin.firestore();
  const uid = userId.trim();
  const now = admin.firestore.Timestamp.now();

  const uSnap = await db.collection(userService.COLLECTION).doc(uid).get();
  if (!uSnap.exists) {
    const err = new Error('Utilisateur introuvable');
    err.status = 404;
    throw err;
  }
  const userData = uSnap.data();

  const qSnap = await db.collection(COLLECTION).where('ownerId', '==', uid).get();

  const invRef = inventoryService.inventoryRef(db, uid);
  const invSnap = await invRef.get();
  const invData = invSnap.exists ? invSnap.data() : { items: {} };

  const emergency = Math.random() < 0.09;
  let vetBill = 0;
  let userGold = Number(userData.wallet_gold);
  if (!Number.isFinite(userGold)) userGold = 0;

  if (emergency) {
    vetBill = Math.floor(30 + Math.random() * 51);
    userGold = Math.max(0, userGold - vetBill);
  }

  const batch = db.batch();
  const dogsSerialized = [];

  qSnap.docs.forEach((doc) => {
    const data = doc.data();
    const ticked = applyTickToStats(data, userData, now);
    batch.update(doc.ref, {
      food: ticked.food,
      water: ticked.water,
      health: ticked.health,
      is_sick: ticked.is_sick,
      last_update: ticked.last_update,
      updatedAt: now,
    });
    const merged = { ...data, ...ticked };
    delete merged.hunger;
    delete merged.thirst;
    dogsSerialized.push(serializeDog(doc.id, merged));
  });

  if (emergency) {
    batch.update(db.collection(userService.COLLECTION).doc(uid), {
      wallet_gold: userGold,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  if (qSnap.size > 0 || emergency) {
    await batch.commit();
  }

  const freshUser = {
    ...userData,
    wallet_gold: emergency ? userGold : Number(userData.wallet_gold) || 0,
  };

  const event_emergency = emergency
    ? { vet_bill: vetBill, wallet_gold_after: userGold }
    : null;

  return buildListResponseDto(uid, freshUser, invData, event_emergency, dogsSerialized);
}

function buildListResponseDto(uid, userData, invData, event_emergency, dogsSerialized) {
  const wallet_gold = Number(userData.wallet_gold) || 0;
  const wallet_gems = Number(userData.wallet_gems) || 0;
  const pseudo = typeof userData.pseudo === 'string' ? userData.pseudo : '';
  const items = inventoryService.normalizeItems(invData.items);

  return {
    userId: uid,
    uid,
    pseudo,
    wallet_gold,
    wallet_gems,
    difficulty_mode: userData.difficulty_mode || 'normal',
    is_demo_mode: !!userData.is_demo_mode,
    unlocked_breeds: Array.isArray(userData.unlocked_breeds) ? userData.unlocked_breeds : [],
    or: wallet_gold,
    gemmes: wallet_gems,
    wallet_soft_gold: wallet_gold,
    wallet_hard_gems: wallet_gems,
    inventory: { ownerId: uid, items },
    event_emergency,
    dogs: dogsSerialized,
  };
}

async function markAbandonment(dogId) {
  const db = admin.firestore();
  const ref = dogDocRef(db, dogId);
  const snap = await ref.get();
  if (!snap.exists) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
  const now = admin.firestore.Timestamp.now();
  await ref.update({
    abandonment_pending_video: true,
    abandonment_marked_at: now,
    updatedAt: now,
  });
  return { id: dogId, abandonment_pending_video: true };
}

module.exports = {
  initDog,
  listDogsForUser,
  markAbandonment,
  applyTickToStats,
  readFood,
  readWater,
  dogDocRef,
  COLLECTION,
  MAX_STAT,
  serializeDog,
};
