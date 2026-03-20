const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');

router.post('/shop/buy', shopController.buy);
router.post('/shop/unlock-breed', shopController.unlockBreed);

module.exports = router;
