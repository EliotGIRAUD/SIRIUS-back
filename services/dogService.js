const crypto = require('crypto');
const { pool, withTransaction } = require('../db');
const userService = require('./userService');
const inventoryService = require('./inventoryService');

const COLLECTION = 'dogs';

const MAX_STAT = 100;

const DEMO_STEP_MS = 10_000;

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

const PERSIST_STATS_MIN_INTERVAL_MS = 120_000;

function normalizeBreedKey(breed) {
  if (typeof breed !== 'string') return '';
  return breed.trim().toLowerCase().replace(/\s+/g, '_');
}

function getBreedProfile(breed) {
  const key = normalizeBreedKey(breed);
  return BREED_PROFILES[key] || BREED_PROFILES.default;
}

function rowToDog(row) {
  return {
    ownerId: row.owner_id,
    name: row.name,
    breed: row.breed,
    food: row.food,
    water: row.water,
    health: row.health,
    is_sick: !!row.is_sick,
    last_update: Number(row.last_update_ms),
    abandonment_pending_video: !!row.abandonment_pending_video,
    abandonment_marked_at: row.abandonment_marked_at,
    active_skin_id: row.active_skin_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readFood(dog) {
  const v = Number(dog.food != null ? dog.food : dog.hunger);
  return Number.isFinite(v) ? v : MAX_STAT;
}

function readWater(dog) {
  const v = Number(dog.water != null ? dog.water : dog.thirst);
  return Number.isFinite(v) ? v : MAX_STAT;
}

function applyTickFromValues(food, water, health, deltaMs, breed, user) {
  const profile = getBreedProfile(breed);
  const isDemo = user.is_demo_mode === true;
  const difficultyMult = user.difficulty_mode === 'hardcore' ? 2 : 1;
  const d = Math.max(0, deltaMs);

  let nextFood;
  let nextWater;
  if (isDemo) {
    const u = d / DEMO_STEP_MS;
    nextFood = Math.max(
      0,
      Math.floor(food - u * profile.demoFoodLossPer10s * difficultyMult + 1e-9)
    );
    nextWater = Math.max(
      0,
      Math.floor(water - u * profile.demoWaterLossPer10s * difficultyMult + 1e-9)
    );
  } else {
    const foodLoss = Math.floor(
      (d / (1000 * 60 * 60)) * profile.foodLossPerHour * difficultyMult
    );
    const waterLoss = Math.floor(
      (d / (1000 * 60 * 60)) * profile.waterLossPerHour * difficultyMult
    );
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
      const healthLoss = Math.floor(
        (d / (1000 * 60 * 60)) *
          profile.healthLossPerHourWhenDepleted *
          difficultyMult
      );
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

function lastUpdateMs(dog) {
  const last = dog.last_update;
  if (typeof last === 'number' && Number.isFinite(last)) return last;
  if (last && typeof last.toMillis === 'function') return last.toMillis();
  if (last instanceof Date) return last.getTime();
  return Date.now();
}

function applyTickToStats(dog, user, nowMs) {
  let food = readFood(dog);
  let water = readWater(dog);
  let health = Number(dog.health);
  if (!Number.isFinite(health)) health = MAX_STAT;

  const lastMs = lastUpdateMs(dog);
  const deltaMs = Math.max(0, nowMs - lastMs);

  const ticked = applyTickFromValues(food, water, health, deltaMs, dog.breed, user);

  return {
    ...ticked,
    last_update: nowMs,
  };
}

function shouldPersistDogDoc(data, nowMs) {
  let lastMs = 0;
  if (data.updatedAt instanceof Date) {
    lastMs = Math.max(lastMs, data.updatedAt.getTime());
  }
  const lu = data.last_update;
  if (typeof lu === 'number' && Number.isFinite(lu)) {
    lastMs = Math.max(lastMs, lu);
  }
  if (lu && typeof lu.toMillis === 'function') {
    lastMs = Math.max(lastMs, lu.toMillis());
  }
  if (lastMs === 0) return true;
  return nowMs - lastMs >= PERSIST_STATS_MIN_INTERVAL_MS;
}

function serializeDog(id, data) {
  if (!data) return null;
  const o = { ...data, id };
  if (typeof o.last_update === 'number' && Number.isFinite(o.last_update)) {
    o.last_update = new Date(o.last_update).toISOString();
  } else if (o.last_update && typeof o.last_update.toDate === 'function') {
    o.last_update = o.last_update.toDate().toISOString();
  }
  if (o.createdAt instanceof Date) {
    o.createdAt = o.createdAt.toISOString();
  } else if (o.createdAt && typeof o.createdAt.toDate === 'function') {
    o.createdAt = o.createdAt.toDate().toISOString();
  }
  if (o.updatedAt instanceof Date) {
    o.updatedAt = o.updatedAt.toISOString();
  } else if (o.updatedAt && typeof o.updatedAt.toDate === 'function') {
    o.updatedAt = o.updatedAt.toDate().toISOString();
  }
  if (o.abandonment_marked_at instanceof Date) {
    o.abandonment_marked_at = o.abandonment_marked_at.toISOString();
  } else if (
    o.abandonment_marked_at &&
    typeof o.abandonment_marked_at.toDate === 'function'
  ) {
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

  const [uRows] = await pool.execute(
    'SELECT uid FROM users WHERE uid = ? LIMIT 1',
    [userId]
  );
  if (!uRows.length) {
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

  const dogId = crypto.randomUUID();
  const nowMs = Date.now();

  await pool.execute(
    `INSERT INTO dogs (id, owner_id, name, breed, food, water, health, is_sick, last_update_ms, abandonment_pending_video, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
    [
      dogId,
      userId,
      name,
      breed || 'golden_retriever',
      MAX_STAT,
      MAX_STAT,
      MAX_STAT,
      nowMs,
    ]
  );
  await inventoryService.ensureInventory(userId);

  const dogPayload = {
    ownerId: userId,
    name,
    breed: breed || 'golden_retriever',
    food: MAX_STAT,
    water: MAX_STAT,
    health: MAX_STAT,
    is_sick: false,
    last_update: nowMs,
    abandonment_pending_video: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return serializeDog(dogId, { ...dogPayload });
}

async function listDogsForUser(userId) {
  const uid = userId.trim();
  const nowMs = Date.now();

  const [uRows] = await pool.execute(
    'SELECT * FROM users WHERE uid = ? LIMIT 1',
    [uid]
  );
  if (!uRows.length) {
    const err = new Error('Utilisateur introuvable');
    err.status = 404;
    throw err;
  }
  const userRow = uRows[0];
  const userDataFull = userService.rowToUser(uid, userRow);

  const [dogRows] = await pool.execute(
    'SELECT * FROM dogs WHERE owner_id = ?',
    [uid]
  );

  let invData = await inventoryService.getInventoryByOwner(uid);
  if (!invData) {
    await inventoryService.ensureInventory(uid);
    invData = await inventoryService.getInventoryByOwner(uid);
  }
  if (!invData) {
    invData = { ownerId: uid, items: inventoryService.normalizeItems({}) };
  }

  const dogsSerialized = [];
  const persistQueue = [];

  for (const row of dogRows) {
    const data = rowToDog(row);
    const ticked = applyTickToStats(data, userDataFull, nowMs);
    if (shouldPersistDogDoc(data, nowMs)) {
      persistQueue.push({
        id: row.id,
        food: ticked.food,
        water: ticked.water,
        health: ticked.health,
        is_sick: ticked.is_sick ? 1 : 0,
        last_update_ms: ticked.last_update,
      });
    }
    const merged = { ...data, ...ticked };
    delete merged.hunger;
    delete merged.thirst;
    merged.tick_meta = buildTickMeta(
      merged.breed || 'golden_retriever',
      userDataFull
    );
    dogsSerialized.push(serializeDog(row.id, merged));
  }

  for (const p of persistQueue) {
    await pool.execute(
      `UPDATE dogs SET food = ?, water = ?, health = ?, is_sick = ?, last_update_ms = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
      [
        p.food,
        p.water,
        p.health,
        p.is_sick,
        p.last_update_ms,
        p.id,
      ]
    );
  }

  return buildListResponseDto(
    uid,
    userDataFull,
    invData,
    null,
    dogsSerialized,
    nowMs
  );
}

function buildListResponseDto(
  uid,
  userData,
  invData,
  event_emergency,
  dogsSerialized,
  serverNowMs
) {
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
    unlocked_breeds: Array.isArray(userData.unlocked_breeds)
      ? userData.unlocked_breeds
      : [],
    or: wallet_gold,
    gemmes: wallet_gems,
    wallet_soft_gold: wallet_gold,
    wallet_hard_gems: wallet_gems,
    inventory: { ownerId: uid, items },
    event_emergency,
    dogs: dogsSerialized,
    unlocked_skins: Array.isArray(userData.unlocked_skins)
      ? userData.unlocked_skins
      : [],
  };
}

async function markAbandonment(dogId) {
  const id = dogId.trim();
  const [rows] = await pool.execute(
    'SELECT id FROM dogs WHERE id = ? LIMIT 1',
    [id]
  );
  if (!rows.length) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
  await pool.execute(
    `UPDATE dogs SET abandonment_pending_video = 1, abandonment_marked_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
    [id]
  );
  return { id, abandonment_pending_video: true };
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

  return withTransaction(async (conn) => {
    const [dRows] = await conn.execute(
      'SELECT * FROM dogs WHERE id = ? FOR UPDATE',
      [did]
    );
    const [uRows] = await conn.execute(
      'SELECT * FROM users WHERE uid = ? FOR UPDATE',
      [uid]
    );
    if (!dRows.length) {
      const err = new Error('Chien introuvable');
      err.status = 404;
      throw err;
    }
    if (!uRows.length) {
      const err = new Error('Utilisateur introuvable');
      err.status = 404;
      throw err;
    }
    const dogRow = dRows[0];
    if (dogRow.owner_id !== uid) {
      const err = new Error('Interdit');
      err.status = 403;
      throw err;
    }
    const u = userService.rowToUser(uid, uRows[0]);
    const unlocked = Array.isArray(u.unlocked_skins) ? u.unlocked_skins : [];
    if (!unlocked.includes(sid) && sid !== 'skin_default') {
      const err = new Error('Skin non possédé');
      err.status = 403;
      throw err;
    }
    await conn.execute(
      'UPDATE dogs SET active_skin_id = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
      [sid, did]
    );
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
  COLLECTION,
  MAX_STAT,
  DEMO_STEP_MS,
  PERSIST_STATS_MIN_INTERVAL_MS,
  serializeDog,
};