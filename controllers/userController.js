const userService = require('../services/userService');

async function updateSettings(req, res) {
  try {
    const ownerId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
    if (!ownerId) {
      res.status(400).json({ error: 'userId requis dans le body' });
      return;
    }

    const out = await userService.updateUserSettings(ownerId, {
      difficulty_mode: req.body?.difficulty_mode,
      is_demo_mode: req.body?.is_demo_mode,
    });

    res.status(200).json(out);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
}

module.exports = { updateSettings };
