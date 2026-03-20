const express = require('express');
const router = express.Router();
const dogController = require('../controllers/dogController');

router.post('/init-dog', dogController.initDog);

module.exports = router;
