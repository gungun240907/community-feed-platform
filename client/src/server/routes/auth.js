const express = require('express');
const router = express.Router();
const { register, login, verifyLoginOtp, resendLoginOtp, getMe, forgotPassword } = require('../controllers/authController');
const { firebaseLogin } = require('../controllers/firebaseAuthController');
const { authenticate } = require('../middleware/auth');
const {
  authLoginLimiter,
  verifyLoginOtpLimiter,
  resendLoginOtpLimiter,
  forgotPasswordLimiter,
  firebaseLoginLimiter,
} = require('../middleware/rateLimiter');
const { validate, resendLoginOtpSchema, firebaseLoginSchema, registerSchema } = require('../middleware/validation');

router.post('/register', authLoginLimiter, validate(registerSchema), register);
router.post('/login', authLoginLimiter, login);
router.post('/verify-login-otp', verifyLoginOtpLimiter, verifyLoginOtp);
router.post('/resend-login-otp', resendLoginOtpLimiter, validate(resendLoginOtpSchema), resendLoginOtp);
router.post('/firebase-login', firebaseLoginLimiter, validate(firebaseLoginSchema), firebaseLogin);
router.get('/me', authenticate, getMe);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);

module.exports = router;
