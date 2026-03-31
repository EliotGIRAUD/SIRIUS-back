const express = require('express');
const router = express.Router();
const dogController = require('../controllers/dogController');

router.post('/init-dog', dogController.initDog);
router.get('/dogs/:userId', dogController.getDogsByUserId);
router.post('/dog/:id/abandon', dogController.abandonDog);
router.patch('/dog/:id/equip-skin', dogController.equipSkin);

module.exports = router;
