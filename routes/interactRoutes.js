const express = require('express');
const router = express.Router();
const interactController = require('../controllers/interactController');

router.patch('/interact/feed', interactController.feed);
router.patch('/interact/water', interactController.water);
router.patch('/interact/clean', interactController.clean);
router.patch('/walk/validate', interactController.validateWalk);

module.exports = router;
