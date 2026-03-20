const dogService = require('../services/dogService');

async function initDog(req, res) {
  try {
    const chien = await dogService.initChien();
    res.status(201).json(chien);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { initDog };
