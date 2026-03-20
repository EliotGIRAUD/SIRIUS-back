const interactService = require('../services/interactService');

async function feed(req, res) {
  try {
    const ownerId = typeof req.body.userId === 'string' ? req.body.userId.trim() : '';
    const dogId = typeof req.body.dogId === 'string' ? req.body.dogId.trim() : '';
    if (!ownerId) {
      res.status(400).json({ error: 'userId requis dans le body' });
      return;
    }
    if (!dogId) {
      res.status(400).json({ error: 'dogId requis dans le body' });
      return;
    }
    const out = await interactService.feedDog(ownerId, dogId);
    res.status(200).json(out);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
}

async function clean(req, res) {
  try {
    const ownerId = typeof req.body.userId === 'string' ? req.body.userId.trim() : '';
    if (!ownerId) {
      res.status(400).json({ error: 'userId requis dans le body' });
      return;
    }
    const out = await interactService.cleanNeeds(ownerId);
    res.status(200).json(out);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
}

async function validateWalk(req, res) {
  try {
    const ownerId = typeof req.body.userId === 'string' ? req.body.userId.trim() : '';
    if (!ownerId) {
      res.status(400).json({ error: 'userId requis dans le body' });
      return;
    }
    const out = await interactService.validateWalk(ownerId, req.body || {});
    res.status(200).json(out);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
}

module.exports = { feed, clean, validateWalk };
