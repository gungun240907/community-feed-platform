const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const {
  getReputationHistory,
  getPrivileges,
  transferReputation,
  getTransferHistory,
  checkCanTransfer,
} = require('../controllers/reputationController');

router.get('/history/:userId', optionalAuth, getReputationHistory);
router.get('/privileges/:userId', optionalAuth, getPrivileges);
router.get('/transfers/:userId', optionalAuth, getTransferHistory);

router.get('/can-transfer', authenticate, checkCanTransfer);
router.post('/transfer', authenticate, transferReputation);

module.exports = router;
