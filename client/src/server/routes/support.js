const express = require('express');
const router = express.Router();
const { submitSupportTicket, getMyTickets } = require('../controllers/supportController');
const { authenticate } = require('../middleware/auth');
const { rateLimitSupport } = require('../middleware/subscription');

router.post('/', authenticate, rateLimitSupport, submitSupportTicket);
router.get('/tickets', authenticate, getMyTickets);

module.exports = router;
