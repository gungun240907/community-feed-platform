const express = require('express');
const router = express.Router();
const { getPersonalizedFeed, getTrendingFeed } = require('../controllers/feedController');
const { authenticate, optionalAuth } = require('../middleware/auth');

router.get('/personalized', authenticate, getPersonalizedFeed);
router.get('/trending', optionalAuth, getTrendingFeed);

module.exports = router;
