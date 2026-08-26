const express = require('express');
const router = express.Router();
const { register, login, verifyLogin, getMe, forgotPassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLoginLimiter, forgotPasswordLimiter } = require('../middleware/rateLimiter');
const { validate, registerSchema } = require('../middleware/validation');

router.post('/register', authLoginLimiter, validate(registerSchema), register);
router.post('/login', authLoginLimiter, login);
router.post('/verify-login', authLoginLimiter, verifyLogin);
router.get('/me', authenticate, getMe);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);

module.exports = router;
