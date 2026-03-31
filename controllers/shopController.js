const economyService = require('../services/economyService');

async function buy(req, res) {
  try {
    const ownerId = typeof req.body.userId === 'string' ? req.body.userId.trim() : '';
    if (!ownerId) {
      res.status(400).json({ error: 'userId requis dans le body' });
      return;
    }
    const out = await economyService.shopBuy(ownerId, req.body || {});
    res.status(200).json(out);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
}

async function unlockBreed(req, res) {
  try {
    const ownerId = typeof req.body.userId === 'string' ? req.body.userId.trim() : '';
    if (!ownerId) {
      res.status(400).json({ error: 'userId requis dans le body' });
      return;
    }
    const out = await economyService.shopUnlockBreed(ownerId, req.body || {});
    res.status(200).json(out);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
}

async function buySkin(req, res) {
  try {
    const ownerId = typeof req.body.userId === 'string' ? req.body.userId.trim() : '';
    if (!ownerId) {
      res.status(400).json({ error: 'userId requis dans le body' });
      return;
    }
    const out = await economyService.shopBuySkin(ownerId, req.body || {});
    res.status(200).json(out);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
}

module.exports = { buy, unlockBreed, buySkin };
