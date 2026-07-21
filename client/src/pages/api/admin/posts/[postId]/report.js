import runHandler from '../../../../../lib/handler.js';
import { authenticate } from '../../../../../lib/middleware/auth.js';
import Report from '../../../../../lib/models/Report.js';
import Post from '../../../../../lib/models/Post.js';

async function createReport(req, res, next) {
  try {
    const { reason, description } = req.body;
    const postId = req.params.postId;

    const post = await Post.findOne({ _id: postId, isDeleted: false });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.author.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot report your own post' });
    }

    if (!reason || !['spam', 'harassment', 'inappropriate', 'misinformation', 'plagiarism', 'other'].includes(reason)) {
      return res.status(400).json({ error: 'Valid reason is required' });
    }

    const existingReport = await Report.findOne({ post: postId, reporter: req.user._id });
    if (existingReport) {
      return res.status(409).json({ error: 'You have already reported this post' });
    }

    const report = await Report.create({
      post: postId,
      reporter: req.user._id,
      reason,
      description,
    });

    await Post.findByIdAndUpdate(postId, { $inc: { reportCount: 1 }, isReported: true });

    res.status(201).json({ message: 'Report submitted', report });
  } catch (error) {
    next(error);
  }
}

export default runHandler((req, res, next) => {
  if (req.method === 'POST') {
    return authenticate(req, res, () => createReport(req, res, next));
  }
  res.status(405).json({ error: 'Method not allowed' });
});
