/**
 * Routes d’authentification prototype — voir API_ROUTES.md.
 */
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/auth/login', authController.login);

module.exports = router;
