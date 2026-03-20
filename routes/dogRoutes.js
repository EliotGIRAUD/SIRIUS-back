/**
 * Routes chien — initialisation et lecture par utilisateur — voir API_ROUTES.md.
 */
const express = require('express');
const router = express.Router();
const dogController = require('../controllers/dogController');

router.post('/init-dog', dogController.initDog);
router.get('/dog/:userId', dogController.getDogByUserId);

module.exports = router;
