const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getLoginHistory } = require('../controllers/loginLogController');

router.get('/', authenticate, getLoginHistory);

module.exports = router;
