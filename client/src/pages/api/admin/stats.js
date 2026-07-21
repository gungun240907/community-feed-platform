import runHandler from '../../../lib/handler.js';
import { authenticate } from '../../../lib/middleware/auth.js';
import { requireAdmin } from '../../../lib/middleware/admin.js';
import User from '../../../lib/models/User.js';
import Post from '../../../lib/models/Post.js';
import Report from '../../../lib/models/Report.js';

async function getDashboardStats(req, res, next) {
  try {
    const [totalUsers, totalPosts, pendingReports, suspendedUsers] = await Promise.all([
      User.countDocuments(),
      Post.countDocuments({ isDeleted: false }),
      Report.countDocuments({ status: 'pending' }),
      User.countDocuments({ status: 'suspended' }),
    ]);

    res.json({
      stats: { totalUsers, totalPosts, pendingReports, suspendedUsers },
    });
  } catch (error) {
    next(error);
  }
}

export default runHandler((req, res, next) => {
  if (req.method === 'GET') {
    return authenticate(req, res, () => {
      requireAdmin(req, res, () => getDashboardStats(req, res, next));
    });
  }
  res.status(405).json({ error: 'Method not allowed' });
});
