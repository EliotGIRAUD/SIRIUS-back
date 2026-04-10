const { withTransaction } = require('../db');
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

  return withTransaction(async (conn) => {
    const [dRows] = await conn.execute(
      'SELECT * FROM dogs WHERE id = ? FOR UPDATE',
      [did]
    );
    const [iRows] = await conn.execute(
      'SELECT * FROM inventory WHERE owner_id = ? FOR UPDATE',
      [uid]
    );
    if (!dRows.length) throw err('Chien introuvable', 404);
    if (!iRows.length) throw err('Inventaire introuvable', 404);

    const dog = dRows[0];
    if (dog.owner_id !== uid) throw err('Interdit', 403);

    const items = inventoryService.normalizeItems({
      croquettes: iRows[0].croquettes,
      water_bottle: iRows[0].water_bottle,
    });
    const n = Number(items.croquettes);
    const croquettes = Number.isFinite(n) ? n : 0;
    if (croquettes < 1) throw err('Pas de croquettes', 400);

    items.croquettes = croquettes - 1;
    const nowMs = Date.now();

    await conn.execute(
      `UPDATE inventory SET croquettes = ?, water_bottle = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE owner_id = ?`,
      [items.croquettes, items.water_bottle, uid]
    );
    await conn.execute(
      `UPDATE dogs SET food = ?, last_update_ms = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
      [dogService.MAX_STAT, nowMs, did]
    );

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

  return withTransaction(async (conn) => {
    const [dRows] = await conn.execute(
      'SELECT * FROM dogs WHERE id = ? FOR UPDATE',
      [did]
    );
    const [iRows] = await conn.execute(
      'SELECT * FROM inventory WHERE owner_id = ? FOR UPDATE',
      [uid]
    );
    if (!dRows.length) throw err('Chien introuvable', 404);
    if (!iRows.length) throw err('Inventaire introuvable', 404);

    const dog = dRows[0];
    if (dog.owner_id !== uid) throw err('Interdit', 403);

    const items = inventoryService.normalizeItems({
      croquettes: iRows[0].croquettes,
      water_bottle: iRows[0].water_bottle,
    });
    const n = Number(items.water_bottle);
    const waterBottle = Number.isFinite(n) ? n : 0;
    if (waterBottle < 1) throw err("Pas d'eau", 400);

    items.water_bottle = waterBottle - 1;
    const nowMs = Date.now();

    await conn.execute(
      `UPDATE inventory SET croquettes = ?, water_bottle = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE owner_id = ?`,
      [items.croquettes, items.water_bottle, uid]
    );
    await conn.execute(
      `UPDATE dogs SET water = ?, last_update_ms = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
      [dogService.MAX_STAT, nowMs, did]
    );

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

  return withTransaction(async (conn) => {
    const [uRows] = await conn.execute(
      'SELECT * FROM users WHERE uid = ? FOR UPDATE',
      [uid]
    );
    if (!uRows.length) throw err('Utilisateur introuvable', 404);
    const u = userService.rowToUser(uid, uRows[0]);
    const gold = Number(u.wallet_gold);
    const safe = Number.isFinite(gold) ? gold : 0;
    const next = safe + CLEAN_GOLD_REWARD;
    await conn.execute(
      'UPDATE users SET wallet_gold = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE uid = ?',
      [next, uid]
    );
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

  return withTransaction(async (conn) => {
    const [uRows] = await conn.execute(
      'SELECT * FROM users WHERE uid = ? FOR UPDATE',
      [uid]
    );
    if (!uRows.length) throw err('Utilisateur introuvable', 404);
    const u = userService.rowToUser(uid, uRows[0]);
    const g = Number(u.wallet_gold);
    const safe = Number.isFinite(g) ? g : 0;
    const next = safe + goldCredit;
    await conn.execute(
      'UPDATE users SET wallet_gold = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE uid = ?',
      [next, uid]
    );
    return {
      speed_kmh: speedKmh,
      wallet_gold_delta: goldCredit,
      wallet_gold: next,
    };
  });
}

module.exports = { feedDog, giveWater, cleanNeeds, validateWalk, CLEAN_GOLD_REWARD };
