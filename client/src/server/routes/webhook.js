const express = require('express');
const router = express.Router();
const { handleRazorpayWebhook } = require('../controllers/subscriptionController');

router.post('/razorpay', express.raw({ type: 'application/json' }), handleRazorpayWebhook);

module.exports = router;
