import runHandler from '../../../../lib/handler.js';
import { authenticate } from '../../../../lib/middleware/auth.js';
import { requireAdmin } from '../../../../lib/middleware/admin.js';
import Report from '../../../../lib/models/Report.js';

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

export default runHandler((req, res, next) => {
  if (req.method === 'GET') {
    return authenticate(req, res, () => {
      requireAdmin(req, res, () => getReportedPosts(req, res, next));
    });
  }
  res.status(405).json({ error: 'Method not allowed' });
});
