const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requestOtp, verifyOtpEndpoint } = require('../controllers/otpController');

router.post('/request', authenticate, requestOtp);
router.post('/verify', authenticate, verifyOtpEndpoint);

module.exports = router;
