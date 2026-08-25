const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  otpRequestLimiter,
  otpVerifyLimiter,
} = require('../middleware/rateLimiter');
const { validate, otpRequestSchema, otpVerifySchema, otpResendSchema } = require('../middleware/validation');
const {
  requestOtp,
  verifyOtpEndpoint,
  resendOtp,
  otpStatus,
} = require('../controllers/otpController');
const { otpChannelConfig } = require('../utils/emailService');

// Request / resend share the same per-IP budget to prevent inbox flooding.
router.post('/request', otpRequestLimiter, validate(otpRequestSchema), authenticate, requestOtp);
router.post('/resend', otpRequestLimiter, validate(otpResendSchema), authenticate, resendOtp);
router.post('/verify', otpVerifyLimiter, validate(otpVerifySchema), authenticate, verifyOtpEndpoint);
router.post('/status', otpRequestLimiter, validate(otpResendSchema), authenticate, otpStatus);

// Read-only view of which OTP channels are wired and the delivery priority.
router.get('/diagnostic', (req, res) => {
  res.json(otpChannelConfig());
});

module.exports = router;
