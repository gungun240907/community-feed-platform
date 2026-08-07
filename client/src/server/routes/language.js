const express = require('express');
const router = express.Router();
const { requestLanguageSwitch, verifyLanguageSwitch } = require('../controllers/languageController');
const { authenticate } = require('../middleware/auth');
const { otpRequestLimiter, otpVerifyLimiter } = require('../middleware/rateLimiter');

router.post('/request', otpRequestLimiter, authenticate, requestLanguageSwitch);
router.post('/verify', otpVerifyLimiter, authenticate, verifyLanguageSwitch);

module.exports = router;
