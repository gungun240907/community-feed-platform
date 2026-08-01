const express = require('express');
const router = express.Router();
const { register, login, verifyLoginOtp, getMe, forgotPassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/verify-login-otp', verifyLoginOtp);
router.get('/me', authenticate, getMe);
router.post('/forgot-password', forgotPassword);

module.exports = router;
