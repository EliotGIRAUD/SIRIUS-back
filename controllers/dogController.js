const dogService = require('../services/dogService');

async function initDog(req, res) {
  try {
    const chien = await dogService.initChien();
    res.status(201).json(chien);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getDog(req, res) {
  try {
    const chien = await dogService.getChien();
    if (!chien) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(200).json(chien);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { initDog, getDog };
