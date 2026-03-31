const dogService = require('../services/dogService');

async function initDog(req, res) {
  try {
    const created = await dogService.initDog(req.body || {});
    res.status(201).json(created);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
}

async function getDogsByUserId(req, res) {
  try {
    const { userId } = req.params;
    const state = await dogService.listDogsForUser(userId);
    res.status(200).json(state);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
}

async function abandonDog(req, res) {
  try {
    const { id } = req.params;
    const out = await dogService.markAbandonment(id);
    res.status(200).json(out);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
}

async function equipSkin(req, res) {
  try {
    const { id } = req.params;
    const ownerId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
    const skinId = typeof req.body?.skinId === 'string' ? req.body.skinId.trim() : '';
    if (!ownerId) {
      res.status(400).json({ error: 'userId requis dans le body' });
      return;
    }
    if (!skinId) {
      res.status(400).json({ error: 'skinId requis dans le body' });
      return;
    }
    const out = await dogService.equipSkin(ownerId, id, skinId);
    res.status(200).json(out);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
}

module.exports = { initDog, getDogsByUserId, abandonDog, equipSkin };
