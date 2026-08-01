const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getActiveSessions,
  revokeSession,
  trustDevice,
  logout,
  revokeAllSessions,
} = require('../controllers/sessionController');

router.get('/', authenticate, getActiveSessions);
router.post('/revoke/:sessionId', authenticate, revokeSession);
router.post('/revoke-all', authenticate, revokeAllSessions);
router.post('/trust', authenticate, trustDevice);
router.post('/logout', authenticate, logout);

module.exports = router;
