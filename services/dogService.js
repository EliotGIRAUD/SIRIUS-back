const admin = require('../config/firebase');
const userService = require('./userService');
const inventoryService = require('./inventoryService');

const COLLECTION = 'dogs';

const MAX_STAT = 100;

/** Wall-clock ms for one “demo step” (legacy 10s cadence). */
const DEMO_STEP_MS = 10_000;

/**
 * Per-breed decay: food/water are 100→0 at these hourly rates (× difficulty).
 * Demo mode uses per–10s steps so the app feels alive in class / Expo Go.
 * Health drops only when food === 0 OR water === 0 (after this tick’s drain).
 */
const BREED_PROFILES = {
  golden_retriever: {
    foodLossPerHour: 5,
    waterLossPerHour: 7,
    healthLossPerHourWhenDepleted: 10,
    demoFoodLossPer10s: 1,
    demoWaterLossPer10s: 1,
    demoHealthLossPer10sWhenDepleted: 2,
  },
  default: {
    foodLossPerHour: 5,
    waterLossPerHour: 5,
    healthLossPerHourWhenDepleted: 10,
    demoFoodLossPer10s: 1,
    demoWaterLossPer10s: 1,
    demoHealthLossPer10sWhenDepleted: 2,
  },
};

function normalizeBreedKey(breed) {
  if (typeof breed !== 'string') return '';
  return breed.trim().toLowerCase().replace(/\s+/g, '_');
}

function getBreedProfile(breed) {
  const key = normalizeBreedKey(breed);
  return BREED_PROFILES[key] || BREED_PROFILES.default;
}

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

/**
 * Pure tick from known values + elapsed ms (shared logic with client `dog-tick-simulation.ts`).
 */
/**
 * Continuous drain in “demo step units” or hours so the UI can tick every second
 * without waiting for full floor(Δt / step) blocks (matches client simulation).
 */
function applyTickFromValues(food, water, health, deltaMs, breed, user) {
  const profile = getBreedProfile(breed);
  const isDemo = user.is_demo_mode === true;
  const difficultyMult = user.difficulty_mode === 'hardcore' ? 2 : 1;
  const d = Math.max(0, deltaMs);

  let nextFood;
  let nextWater;
  if (isDemo) {
    const u = d / DEMO_STEP_MS;
    nextFood = Math.max(0, Math.floor(food - u * profile.demoFoodLossPer10s * difficultyMult + 1e-9));
    nextWater = Math.max(0, Math.floor(water - u * profile.demoWaterLossPer10s * difficultyMult + 1e-9));
  } else {
    const foodLoss = Math.floor((d / (1000 * 60 * 60)) * profile.foodLossPerHour * difficultyMult);
    const waterLoss = Math.floor((d / (1000 * 60 * 60)) * profile.waterLossPerHour * difficultyMult);
    nextFood = Math.max(0, food - foodLoss);
    nextWater = Math.max(0, water - waterLoss);
  }

  let nextHealth = health;
  if (nextFood === 0 || nextWater === 0) {
    if (isDemo) {
      const u = d / DEMO_STEP_MS;
      const lost = u * profile.demoHealthLossPer10sWhenDepleted * difficultyMult;
      nextHealth = Math.max(0, Math.floor(health - lost + 1e-9));
    } else {
      const healthLoss = Math.floor((d / (1000 * 60 * 60)) * profile.healthLossPerHourWhenDepleted * difficultyMult);
      nextHealth = Math.max(0, health - healthLoss);
    }
  }

  return {
    food: nextFood,
    water: nextWater,
    health: nextHealth,
    is_sick: nextHealth < 50,
  };
}

function buildTickMeta(breed, userData) {
  const profile = getBreedProfile(breed);
  return {
    demoStepMs: DEMO_STEP_MS,
    is_demo_mode: userData.is_demo_mode === true,
    difficulty_hardcore: userData.difficulty_mode === 'hardcore',
    foodLossPerHour: profile.foodLossPerHour,
    waterLossPerHour: profile.waterLossPerHour,
    healthLossPerHourWhenDepleted: profile.healthLossPerHourWhenDepleted,
    demoFoodLossPer10s: profile.demoFoodLossPer10s,
    demoWaterLossPer10s: profile.demoWaterLossPer10s,
    demoHealthLossPer10sWhenDepleted: profile.demoHealthLossPer10sWhenDepleted,
  };
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

  const ticked = applyTickFromValues(food, water, health, deltaMs, dog.breed, user);

  return {
    ...ticked,
    last_update: nowTs,
  };
}

/** Min ms between persisting dog stats to Firestore on GET (response still uses live computed values). */
const PERSIST_STATS_MIN_INTERVAL_MS = 120_000;

function shouldPersistDogDoc(data, nowTs) {
  const nowMs = nowTs.toMillis();
  let lastMs = 0;
  if (data.updatedAt && typeof data.updatedAt.toMillis === 'function') {
    lastMs = Math.max(lastMs, data.updatedAt.toMillis());
  }
  if (data.last_update && typeof data.last_update.toMillis === 'function') {
    lastMs = Math.max(lastMs, data.last_update.toMillis());
  }
  if (lastMs === 0) return true;
  return nowMs - lastMs >= PERSIST_STATS_MIN_INTERVAL_MS;
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

  const batch = db.batch();
  const dogsSerialized = [];
  let dogBatchWrites = 0;

  qSnap.docs.forEach((doc) => {
    const data = doc.data();
    const ticked = applyTickToStats(data, userData, now);
    if (shouldPersistDogDoc(data, now)) {
      batch.update(doc.ref, {
        food: ticked.food,
        water: ticked.water,
        health: ticked.health,
        is_sick: ticked.is_sick,
        last_update: ticked.last_update,
        updatedAt: now,
      });
      dogBatchWrites += 1;
    }
    const merged = { ...data, ...ticked };
    delete merged.hunger;
    delete merged.thirst;
    merged.tick_meta = buildTickMeta(merged.breed || 'golden_retriever', userData);
    dogsSerialized.push(serializeDog(doc.id, merged));
  });

  if (dogBatchWrites > 0) {
    await batch.commit();
  }

  /** Or / gemmes : inchangés ici — seulement shop, interactions, etc. */
  return buildListResponseDto(uid, userData, invData, null, dogsSerialized, now.toMillis());
}

function buildListResponseDto(uid, userData, invData, event_emergency, dogsSerialized, serverNowMs) {
  const wallet_gold = Number(userData.wallet_gold) || 0;
  const wallet_gems = Number(userData.wallet_gems) || 0;
  const pseudo = typeof userData.pseudo === 'string' ? userData.pseudo : '';
  const items = inventoryService.normalizeItems(invData.items);

  return {
    userId: uid,
    uid,
    server_now_ms: typeof serverNowMs === 'number' ? serverNowMs : Date.now(),
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

async function equipSkin(ownerId, dogId, skinId) {
  const uid = typeof ownerId === 'string' ? ownerId.trim() : '';
  const did = typeof dogId === 'string' ? dogId.trim() : '';
  const sid = typeof skinId === 'string' ? skinId.trim() : '';
  if (!uid) {
    const err = new Error('userId invalide');
    err.status = 400;
    throw err;
  }
  if (!did) {
    const err = new Error('dogId invalide');
    err.status = 400;
    throw err;
  }
  if (!sid) {
    const err = new Error('skinId requis');
    err.status = 400;
    throw err;
  }

  const db = admin.firestore();
  const dRef = dogDocRef(db, did);
  const uRef = db.collection(userService.COLLECTION).doc(uid);

  return db.runTransaction(async (tx) => {
    const [dSnap, uSnap] = await Promise.all([tx.get(dRef), tx.get(uRef)]);
    if (!dSnap.exists) {
      const err = new Error('Chien introuvable');
      err.status = 404;
      throw err;
    }
    if (!uSnap.exists) {
      const err = new Error('Utilisateur introuvable');
      err.status = 404;
      throw err;
    }

    const dog = dSnap.data();
    if (dog.ownerId !== uid) {
      const err = new Error('Interdit');
      err.status = 403;
      throw err;
    }

    const u = uSnap.data();
    const unlocked = Array.isArray(u.unlocked_skins) ? u.unlocked_skins : [];
    if (!unlocked.includes(sid) && sid !== 'skin_default') {
      const err = new Error('Skin non possédé');
      err.status = 403;
      throw err;
    }

    const now = admin.firestore.Timestamp.now();
    tx.update(dRef, {
      active_skin_id: sid,
      updatedAt: now,
    });

    return { dogId: did, active_skin_id: sid };
  });
}

module.exports = {
  initDog,
  listDogsForUser,
  markAbandonment,
  applyTickToStats,
  applyTickFromValues,
  buildTickMeta,
  readFood,
  readWater,
  getBreedProfile,
  BREED_PROFILES,
  equipSkin,
  dogDocRef,
  COLLECTION,
  MAX_STAT,
  DEMO_STEP_MS,
  PERSIST_STATS_MIN_INTERVAL_MS,
  serializeDog,
};
