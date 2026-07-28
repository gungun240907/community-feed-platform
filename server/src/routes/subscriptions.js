const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createSubscription,
  verifyPayment,
  getSubscriptionStatus,
  getPaymentHistory,
  cancelSubscription,
  reactivateSubscription,
  devActivateSubscription,
} = require('../controllers/subscriptionController');

router.post('/create-subscription', authenticate, createSubscription);
router.post('/verify-payment', authenticate, verifyPayment);
router.get('/status', authenticate, getSubscriptionStatus);
router.get('/payments', authenticate, getPaymentHistory);
router.post('/cancel', authenticate, cancelSubscription);
router.post('/reactivate', authenticate, reactivateSubscription);
router.post('/dev-activate', authenticate, devActivateSubscription);

module.exports = router;
