const userService = require('../services/userService');
const admin = require('../config/firebase');

function pickPseudoFromRequest(decoded, req) {
  const pseudoRaw = req?.body && req.body.pseudo;
  if (typeof pseudoRaw === 'string' && pseudoRaw.trim()) return pseudoRaw.trim();
  if (typeof decoded?.email === 'string' && decoded.email.trim()) return decoded.email.trim();
  return '';
}

async function login(req, res) {
  try {
    const idTokenRaw = req.body && req.body.idToken;
    const idToken = typeof idTokenRaw === 'string' ? idTokenRaw.trim() : '';
    if (!idToken) {
      res.status(400).json({ error: 'Champ requis : idToken (string non vide)' });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = typeof decoded?.uid === 'string' ? decoded.uid : '';
    if (!uid) {
      res.status(401).json({ error: 'Token invalide' });
      return;
    }

    const pseudoBodyRaw = req?.body && req.body.pseudo;
    let pseudo = '';
    if (typeof pseudoBodyRaw === 'string' && pseudoBodyRaw.trim()) {
      pseudo = pseudoBodyRaw.trim();
    } else {
      const existingUser = await userService.getUserById(uid);
      const existingPseudo = existingUser && typeof existingUser.pseudo === 'string' ? existingUser.pseudo.trim() : '';
      pseudo = existingPseudo || (typeof decoded?.email === 'string' ? decoded.email.trim() : '') || uid;
    }
    await userService.upsertUser(uid, pseudo);

    res.status(200).json({
      uid,
      pseudo: pseudo || decoded.email || uid,
      message: 'Connexion Firebase validée',
    });
  } catch (error) {
    const status = error && error.code === 'auth/argument-error' ? 400 : error && error.code === 'auth/invalid-id-token' ? 401 : 500;
    res.status(status).json({ error: error.message || 'Erreur auth' });
  }
}

async function register(req, res) {
  try {
    const idTokenRaw = req.body && req.body.idToken;
    const idToken = typeof idTokenRaw === 'string' ? idTokenRaw.trim() : '';
    if (!idToken) {
      res.status(400).json({ error: 'Champ requis : idToken (string non vide)' });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = typeof decoded?.uid === 'string' ? decoded.uid : '';
    if (!uid) {
      res.status(401).json({ error: 'Token invalide' });
      return;
    }

    const pseudo = pickPseudoFromRequest(decoded, req);
    await userService.upsertUser(uid, pseudo || decoded.email || uid);

    res.status(200).json({
      uid,
      pseudo: pseudo || decoded.email || uid,
      message: 'Profil utilisateur créé/initialisé',
    });
  } catch (error) {
    const status = error && error.code === 'auth/argument-error' ? 400 : error && error.code === 'auth/invalid-id-token' ? 401 : 500;
    res.status(status).json({ error: error.message || 'Erreur auth' });
  }
}

module.exports = { login, register };
