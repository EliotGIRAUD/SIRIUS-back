const userService = require('../services/userService');

const PROTOTYPE_UID = process.env.PROTOTYPE_FIXED_UID || 'proto-sirius-user-001';

/**
 * POST /auth/login — connexion simulée pour le prototype.
 * On exige un pseudo enregistré sur le compte (document users/{uid}).
 * On ignore email / mot de passe ; on renvoie toujours le même uid pour que le front
 * puisse enchaîner avec POST /init-dog et GET /dog/:userId avec un userId stable.
 */
async function login(req, res) {
  try {
    const pseudoRaw = req.body && req.body.pseudo;
    const pseudo = typeof pseudoRaw === 'string' ? pseudoRaw.trim() : '';
    if (!pseudo) {
      res.status(400).json({ error: 'Champ requis : pseudo (string non vide)' });
      return;
    }
    await userService.upsertUser(PROTOTYPE_UID, pseudo);
    res.status(200).json({
      uid: PROTOTYPE_UID,
      pseudo,
      message: 'Connexion simulée (prototype Jalon 1)',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { login };
