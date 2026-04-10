const { pool } = require('../db');

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
  const id = ownerId.trim();
  await pool.execute(
    `INSERT IGNORE INTO inventory (owner_id, croquettes, water_bottle, created_at, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
    [id, DEFAULT_ITEMS.croquettes, DEFAULT_ITEMS.water_bottle]
  );
}

async function createInventory(ownerId) {
  await ensureInventory(ownerId);
  return getInventoryByOwner(ownerId);
}

async function getInventoryByOwner(ownerId) {
  if (!ownerId || typeof ownerId !== 'string') return null;
  const [rows] = await pool.execute(
    'SELECT * FROM inventory WHERE owner_id = ? LIMIT 1',
    [ownerId.trim()]
  );
  if (!rows.length) return null;
  const d = rows[0];
  return {
    ownerId: d.owner_id || ownerId.trim(),
    items: normalizeItems({
      croquettes: d.croquettes,
      water_bottle: d.water_bottle,
    }),
  };
}

module.exports = {
  createInventory,
  ensureInventory,
  getInventoryByOwner,
  normalizeItems,
  DEFAULT_ITEMS,
  COLLECTION,
};
