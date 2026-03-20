const dogService = require('../services/dogService');
const userService = require('../services/userService');

/**
 * POST /init-dog
 * Body JSON : { "name": "...", "userId": "...", "race": "..." optionnel }
 */
async function initDog(req, res) {
  try {
    const chien = await dogService.initChien(req.body || {});
    res.status(201).json(chien);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
}

/**
 * GET /dog/:userId
 * Renvoie toutes les stats du dashboard pour cet utilisateur (faim, santé, maladie, or, gemmes, nom, etc.).
 */
async function getDogByUserId(req, res) {
  try {
    const { userId } = req.params;
    const chien = await dogService.getChienByUserId(userId);
    if (!chien) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const hunger = Number(chien.hunger) || 0;
    const health = Number(chien.health) || 0;
    const maladie = Number(chien.maladie) || 0;
    const wallet_soft_gold = Number(chien.wallet_soft_gold) || 0;
    const wallet_hard_gems = Number(chien.wallet_hard_gems) || 0;

    const userProfile = await userService.getUserById(userId);
    const pseudo = userProfile && typeof userProfile.pseudo === 'string' ? userProfile.pseudo : '';

    res.status(200).json({
      userId: chien.userId,
      pseudo,
      name: chien.name ?? chien.nom ?? '',
      nom: chien.nom ?? chien.name ?? '',
      race: chien.race ?? '',
      hunger,
      health,
      maladie,
      wallet_soft_gold,
      wallet_hard_gems,
      faim: hunger,
      sante: health,
      or: wallet_soft_gold,
      gemmes: wallet_hard_gems,
      createdAt: chien.createdAt,
      updatedAt: chien.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { initDog, getDogByUserId };
