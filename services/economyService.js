const { withTransaction } = require('../db');
const userService = require('./userService');
const inventoryService = require('./inventoryService');

const PRICES_GOLD = {
  croquettes: 20,
  water_bottle: 25,
};

const BREED_GEM_COST = {
  husky: 150,
  beagle: 120,
  berger_allemand: 200,
};

const SKIN_GEM_COST = {
  skin_default: 0,
  skin_space: 80,
  skin_neon: 120,
};

function err(msg, status) {
  const e = new Error(msg);
  e.status = status;
  return e;
}

async function shopBuy(ownerId, body = {}) {
  const uid = typeof ownerId === 'string' ? ownerId.trim() : '';
  if (!uid) throw err('ownerId invalide', 400);

  const itemRaw = body.item != null ? body.item : body.produit;
  const item = typeof itemRaw === 'string' ? itemRaw.trim() : '';
  const qty = Number(body.quantity != null ? body.quantity : 1);
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
    throw err('quantity invalide : entier strictement positif', 400);
  }

  const unit = PRICES_GOLD[item];
  if (unit == null) throw err('article inconnu (croquettes | water_bottle)', 400);

  const cost = Number(unit) * qty;

  return withTransaction(async (conn) => {
    const [uRows] = await conn.execute(
      'SELECT * FROM users WHERE uid = ? FOR UPDATE',
      [uid]
    );
    const [iRows] = await conn.execute(
      'SELECT * FROM inventory WHERE owner_id = ? FOR UPDATE',
      [uid]
    );
    if (!uRows.length) throw err('Utilisateur introuvable', 404);
    if (!iRows.length) throw err('Inventaire introuvable', 404);

    const u = userService.rowToUser(uid, uRows[0]);
    const gold = Number(u.wallet_gold);
    const safeGold = Number.isFinite(gold) ? gold : 0;
    if (safeGold < cost) throw err('Solde insuffisant', 400);

    const ir = iRows[0];
    const items = inventoryService.normalizeItems({
      croquettes: ir.croquettes,
      water_bottle: ir.water_bottle,
    });
    if (item === 'croquettes') items.croquettes += qty;
    else if (item === 'water_bottle') items.water_bottle += qty;

    const nextGold = safeGold - cost;

    await conn.execute(
      'UPDATE users SET wallet_gold = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE uid = ?',
      [nextGold, uid]
    );
    await conn.execute(
      `UPDATE inventory SET croquettes = ?, water_bottle = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE owner_id = ?`,
      [items.croquettes, items.water_bottle, uid]
    );

    return {
      wallet_gold: nextGold,
      spent: cost,
      items,
      item,
      quantity: qty,
    };
  });
}

async function shopUnlockBreed(ownerId, body = {}) {
  const uid = typeof ownerId === 'string' ? ownerId.trim() : '';
  if (!uid) throw err('ownerId invalide', 400);

  const breedRaw = body.breed != null ? body.breed : body.race;
  const breed =
    typeof breedRaw === 'string'
      ? breedRaw.trim().toLowerCase().replace(/\s+/g, '_')
      : '';
  if (!breed) throw err('breed requis', 400);

  const cost = BREED_GEM_COST[breed];
  if (cost == null) throw err('race non achetable ou inconnue', 400);

  return withTransaction(async (conn) => {
    const [uRows] = await conn.execute(
      'SELECT * FROM users WHERE uid = ? FOR UPDATE',
      [uid]
    );
    if (!uRows.length) throw err('Utilisateur introuvable', 404);

    const u = userService.rowToUser(uid, uRows[0]);
    const gems = Number(u.wallet_gems);
    const safeGems = Number.isFinite(gems) ? gems : 0;
    if (safeGems < cost) throw err('Gemmes insuffisantes', 400);

    const unlocked = Array.isArray(u.unlocked_breeds) ? [...u.unlocked_breeds] : [];
    if (unlocked.includes(breed)) throw err('Race déjà débloquée', 400);

    unlocked.push(breed);
    const nextGems = safeGems - cost;

    await conn.execute(
      `UPDATE users SET wallet_gems = ?, unlocked_breeds = CAST(? AS JSON), updated_at = CURRENT_TIMESTAMP(3) WHERE uid = ?`,
      [nextGems, JSON.stringify(unlocked), uid]
    );

    return {
      wallet_gems: nextGems,
      spent_gems: cost,
      unlocked_breeds: unlocked,
      breed,
    };
  });
}

async function shopBuySkin(ownerId, body = {}) {
  const uid = typeof ownerId === 'string' ? ownerId.trim() : '';
  if (!uid) throw err('ownerId invalide', 400);

  const skinRaw = body.skinId != null ? body.skinId : body.skin_id;
  const skinId = typeof skinRaw === 'string' ? skinRaw.trim() : '';
  if (!skinId) throw err('skinId requis', 400);

  const cost = SKIN_GEM_COST[skinId];
  if (cost == null) throw err('skin inconnu ou non achetable', 400);
  if (cost <= 0) throw err('skin gratuit non achetable', 400);

  return withTransaction(async (conn) => {
    const [uRows] = await conn.execute(
      'SELECT * FROM users WHERE uid = ? FOR UPDATE',
      [uid]
    );
    if (!uRows.length) throw err('Utilisateur introuvable', 404);

    const u = userService.rowToUser(uid, uRows[0]);
    const gems = Number(u.wallet_gems);
    const safeGems = Number.isFinite(gems) ? gems : 0;
    if (safeGems < cost) throw err('Gemmes insuffisantes', 400);

    const unlocked = Array.isArray(u.unlocked_skins) ? [...u.unlocked_skins] : [];
    if (unlocked.includes(skinId)) throw err('Skin déjà débloqué', 400);

    unlocked.push(skinId);
    const nextGems = safeGems - cost;

    await conn.execute(
      `UPDATE users SET wallet_gems = ?, unlocked_skins = CAST(? AS JSON), updated_at = CURRENT_TIMESTAMP(3) WHERE uid = ?`,
      [nextGems, JSON.stringify(unlocked), uid]
    );

    return {
      wallet_gems: nextGems,
      spent_gems: cost,
      unlocked_skins: unlocked,
      skinId,
    };
  });
}

module.exports = {
  shopBuy,
  shopUnlockBreed,
  shopBuySkin,
  PRICES_GOLD,
  BREED_GEM_COST,
  SKIN_GEM_COST,
};
