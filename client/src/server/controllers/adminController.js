const Report = require('../models/Report');
const Post = require('../models/Post');
const User = require('../models/User');
const { addReputation } = require('../utils/reputationHelper');
const { recordAdminViolation } = require('../utils/violationHelper');

async function getReportedPosts(req, res, next) {
  try {
    const reports = await Report.aggregate([
      { $match: { status: 'pending' } },
      {
        $group: {
          _id: '$post',
          reportCount: { $sum: 1 },
          reports: { $push: { _id: '$_id', reporter: '$reporter', reason: '$reason', description: '$description', createdAt: '$createdAt' } },
        },
      },
      { $sort: { reportCount: -1 } },
      {
        $lookup: {
          from: 'posts',
          localField: '_id',
          foreignField: '_id',
          as: 'post',
        },
      },
      { $unwind: '$post' },
      { $match: { 'post.isDeleted': false } },
      {
        $lookup: {
          from: 'users',
          localField: 'post.author',
          foreignField: '_id',
          as: 'post.author',
        },
      },
      { $unwind: '$post.author' },
      {
        $project: {
          'post.author.password': 0,
          'post.author.__v': 0,
        },
      },
    ]);

    res.json({ reportedPosts: reports });
  } catch (error) {
    next(error);
  }
}

async function dismissReport(req, res, next) {
  try {
    const { reportId } = req.params;
    const report = await Report.findByIdAndUpdate(
      reportId,
      { status: 'dismissed', actionedBy: req.user._id, actionedAt: new Date() },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ message: 'Report dismissed', report });
  } catch (error) {
    next(error);
  }
}

async function deletePostAsAdmin(req, res, next) {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.isDeleted) {
      return res.status(409).json({ message: 'Post already removed by an administrator' });
    }

    post.isDeleted = true;
    post.deletedAt = new Date();
    await post.save();

    await Report.updateMany(
      { post: postId, status: 'pending' },
      { status: 'actioned', actionedBy: req.user._id, actionedAt: new Date() }
    );

    await addReputation(post.author, 'admin_removed', 'post', post._id);

    await recordAdminViolation(post.author, req.app.get('io'));

    res.json({ message: 'Post deleted and associated reports actioned' });
  } catch (error) {
    next(error);
  }
}

async function suspendUser(req, res, next) {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot suspend another admin' });
    }

    user.status = 'suspended';
    await user.save();

    const io = req.app.get('io');
    if (io) {
      io.to(userId).emit('accountSuspended', { reason: 'Your account has been suspended by an administrator.' });
    }

    res.json({ message: 'User suspended', user: { _id: user._id, username: user.username, status: user.status } });
  } catch (error) {
    next(error);
  }
}

async function unsuspendUser(req, res, next) {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndUpdate(userId, { status: 'active' }, { new: true });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User unsuspended', user: { _id: user._id, username: user.username, status: user.status } });
  } catch (error) {
    next(error);
  }
}

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

module.exports = { getReportedPosts, dismissReport, deletePostAsAdmin, suspendUser, unsuspendUser, getDashboardStats };
