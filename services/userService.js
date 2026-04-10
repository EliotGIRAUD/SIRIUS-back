const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { pool } = require('../db');

const COLLECTION = 'users';

const DEFAULT_USER = {
  wallet_gold: 500,
  wallet_gems: 50,
  difficulty_mode: 'normal',
  is_demo_mode: true,
  unlocked_breeds: ['golden_retriever'],
  unlocked_skins: [],
};

function parseJsonArray(v, fallback) {
  if (v == null) return [...fallback];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [...fallback];
    } catch {
      return [...fallback];
    }
  }
  return [...fallback];
}

function rowToUser(uid, row) {
  if (!row) return null;
  const wg = Number(row.wallet_gold);
  const wgm = Number(row.wallet_gems);
  const out = {
    uid: row.uid || uid,
    pseudo: typeof row.pseudo === 'string' ? row.pseudo : '',
    email: typeof row.email === 'string' ? row.email : '',
    wallet_gold: Number.isFinite(wg) ? wg : 0,
    wallet_gems: Number.isFinite(wgm) ? wgm : 0,
    difficulty_mode: row.difficulty_mode || 'normal',
    is_demo_mode: row.is_demo_mode === 1 || row.is_demo_mode === true,
    unlocked_breeds: parseJsonArray(row.unlocked_breeds, DEFAULT_USER.unlocked_breeds),
    unlocked_skins: parseJsonArray(row.unlocked_skins, DEFAULT_USER.unlocked_skins),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (out.createdAt instanceof Date) {
    out.createdAt = out.createdAt.toISOString();
  }
  if (out.updatedAt instanceof Date) {
    out.updatedAt = out.updatedAt.toISOString();
  }
  return out;
}

function normalizeUser(uid, data) {
  if (!data) return null;
  return rowToUser(uid, {
    uid: data.uid || uid,
    pseudo: data.pseudo,
    email: data.email,
    wallet_gold: data.wallet_gold,
    wallet_gems: data.wallet_gems,
    difficulty_mode: data.difficulty_mode,
    is_demo_mode: data.is_demo_mode ? 1 : 0,
    unlocked_breeds: data.unlocked_breeds,
    unlocked_skins: data.unlocked_skins,
    created_at: data.createdAt,
    updated_at: data.updatedAt,
  });
}

async function createUserWithCredentials(email, password, pseudo) {
  const emailNorm = email.trim().toLowerCase();
  const trimmedPseudo = typeof pseudo === 'string' ? pseudo.trim() : '';
  if (!emailNorm || !password) {
    const err = new Error('email et mot de passe requis');
    err.status = 400;
    throw err;
  }
  if (!trimmedPseudo) {
    const err = new Error('pseudo requis');
    err.status = 400;
    throw err;
  }
  const uid = crypto.randomUUID();
  const hash = await bcrypt.hash(password, 12);
  const breedsJson = JSON.stringify(DEFAULT_USER.unlocked_breeds);
  const skinsJson = JSON.stringify(DEFAULT_USER.unlocked_skins);
  try {
    await pool.execute(
      `INSERT INTO users (uid, pseudo, email, password_hash, wallet_gold, wallet_gems, difficulty_mode, is_demo_mode, unlocked_breeds, unlocked_skins)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON))`,
      [
        uid,
        trimmedPseudo,
        emailNorm,
        hash,
        DEFAULT_USER.wallet_gold,
        DEFAULT_USER.wallet_gems,
        DEFAULT_USER.difficulty_mode,
        DEFAULT_USER.is_demo_mode ? 1 : 0,
        breedsJson,
        skinsJson,
      ]
    );
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      const err = new Error('Email déjà utilisé');
      err.status = 409;
      throw err;
    }
    throw e;
  }
  const [rows] = await pool.execute('SELECT * FROM users WHERE uid = ? LIMIT 1', [uid]);
  return rowToUser(uid, rows[0]);
}

async function verifyCredentials(email, password) {
  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm || !password) {
    const err = new Error('email et mot de passe requis');
    err.status = 400;
    throw err;
  }
  const [rows] = await pool.execute(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [emailNorm]
  );
  if (!rows.length) {
    const err = new Error('Identifiants invalides');
    err.status = 401;
    throw err;
  }
  const row = rows[0];
  if (!row.password_hash) {
    const err = new Error('Identifiants invalides');
    err.status = 401;
    throw err;
  }
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    const err = new Error('Identifiants invalides');
    err.status = 401;
    throw err;
  }
  return rowToUser(row.uid, row);
}

async function getUserById(userId) {
  if (!userId || typeof userId !== 'string') return null;
  const [rows] = await pool.execute(
    'SELECT * FROM users WHERE uid = ? LIMIT 1',
    [userId.trim()]
  );
  if (!rows.length) return null;
  return rowToUser(userId.trim(), rows[0]);
}

async function updateUserSettings(userId, settings = {}) {
  const uid = typeof userId === 'string' ? userId.trim() : '';
  if (!uid) {
    const err = new Error('userId invalide');
    err.status = 400;
    throw err;
  }
  const [rows] = await pool.execute(
    'SELECT * FROM users WHERE uid = ? LIMIT 1',
    [uid]
  );
  if (!rows.length) {
    const err = new Error('Utilisateur introuvable');
    err.status = 404;
    throw err;
  }
  const updates = [];
  const vals = [];
  if (settings.difficulty_mode !== undefined) {
    const mode =
      typeof settings.difficulty_mode === 'string'
        ? settings.difficulty_mode.trim()
        : '';
    if (!mode || (mode !== 'normal' && mode !== 'hardcore')) {
      const err = new Error("difficulty_mode invalide (normal | hardcore)");
      err.status = 400;
      throw err;
    }
    updates.push('difficulty_mode = ?');
    vals.push(mode);
  }
  if (settings.is_demo_mode !== undefined) {
    if (typeof settings.is_demo_mode !== 'boolean') {
      const err = new Error('is_demo_mode invalide (boolean)');
      err.status = 400;
      throw err;
    }
    updates.push('is_demo_mode = ?');
    vals.push(settings.is_demo_mode ? 1 : 0);
  }
  if (updates.length > 0) {
    vals.push(uid);
    await pool.execute(
      `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP(3) WHERE uid = ?`,
      vals
    );
  }
  const [again] = await pool.execute(
    'SELECT * FROM users WHERE uid = ? LIMIT 1',
    [uid]
  );
  return rowToUser(uid, again[0]);
}

module.exports = {
  createUserWithCredentials,
  verifyCredentials,
  getUserById,
  updateUserSettings,
  normalizeUser,
  rowToUser,
  COLLECTION,
  DEFAULT_USER,
};
