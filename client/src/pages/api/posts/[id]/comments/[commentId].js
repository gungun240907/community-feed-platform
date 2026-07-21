import runHandler from '../../../../../lib/handler.js';
import Post from '../../../../../lib/models/Post.js';
import Comment from '../../../../../lib/models/Comment.js';
import { authenticate } from '../../../../../lib/middleware/auth.js';

function applyMiddleware(req, res, fn) {
  return new Promise((resolve) => {
    fn(req, res, () => resolve());
    resolve();
  });
}

async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await applyMiddleware(req, res, authenticate);
  if (!req.user) return;

  const comment = await Comment.findById(req.params.commentId);
  if (!comment) {
    return res.status(404).json({ error: 'Comment not found' });
  }

  if (comment.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized to delete this comment' });
  }

  comment.isDeleted = true;
  await comment.save();

  await Post.findByIdAndUpdate(comment.post, { $inc: { commentCount: -1 } });

  res.status(200).json({ message: 'Comment deleted' });
}

export default runHandler(handler);
