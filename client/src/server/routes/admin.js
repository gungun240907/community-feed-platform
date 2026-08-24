const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { requireReputation } = require('../middleware/reputation');
const {
  getReportedPosts,
  dismissReport,
  deletePostAsAdmin,
  suspendUser,
  unsuspendUser,
  getDashboardStats,
} = require('../controllers/adminController');
const { createReport } = require('../controllers/reportController');
const { getAllLoginLogs } = require('../controllers/loginLogController');

router.use(authenticate);

router.get('/reports', requireAdmin, getReportedPosts);
router.put('/reports/:reportId/dismiss', requireAdmin, dismissReport);
router.delete('/posts/:postId', requireAdmin, deletePostAsAdmin);
router.put('/users/:userId/suspend', requireAdmin, suspendUser);
router.put('/users/:userId/unsuspend', requireAdmin, unsuspendUser);
router.get('/stats', requireAdmin, getDashboardStats);
router.get('/login-logs', requireAdmin, getAllLoginLogs);

router.post('/posts/:id/report', requireReputation(500), createReport);

module.exports = router;
