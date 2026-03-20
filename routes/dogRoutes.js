const express = require('express');
const router = express.Router();
const dogController = require('../controllers/dogController');

router.post('/init-dog', dogController.initDog);
router.get('/dog', dogController.getDog);

module.exports = router;
