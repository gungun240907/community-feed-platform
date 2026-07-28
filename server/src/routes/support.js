const express = require('express');
const router = express.Router();
const { submitSupportTicket } = require('../controllers/supportController');
const { authenticate } = require('../middleware/auth');
const { rateLimitSupport } = require('../middleware/subscription');

router.post('/', authenticate, rateLimitSupport, submitSupportTicket);

module.exports = router;
