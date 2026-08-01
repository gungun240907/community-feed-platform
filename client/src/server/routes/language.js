const express = require('express');
const router = express.Router();
const { requestLanguageSwitch, verifyLanguageSwitch } = require('../controllers/languageController');
const { authenticate } = require('../middleware/auth');

router.post('/request', authenticate, requestLanguageSwitch);
router.post('/verify', authenticate, verifyLanguageSwitch);

module.exports = router;
