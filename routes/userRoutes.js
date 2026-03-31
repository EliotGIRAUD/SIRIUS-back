const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.patch('/user/settings', userController.updateSettings);

module.exports = router;
