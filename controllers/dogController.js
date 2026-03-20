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

module.exports = { initDog, getDogsByUserId, abandonDog };
