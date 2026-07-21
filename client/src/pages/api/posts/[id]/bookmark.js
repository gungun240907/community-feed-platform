import runHandler from '../../../../lib/handler.js';
import Post from '../../../../lib/models/Post.js';
import Like from '../../../../lib/models/Like.js';
import { authenticate } from '../../../../lib/middleware/auth.js';

function applyMiddleware(req, res, fn) {
  return new Promise((resolve) => {
    fn(req, res, () => resolve());
    resolve();
  });
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await applyMiddleware(req, res, authenticate);
  if (!req.user) return;

  const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const existing = await Like.findOne({
    user: req.user._id,
    post: post._id,
    type: 'bookmark',
  });

  if (existing) {
    await Like.deleteOne({ _id: existing._id });
    await Post.findByIdAndUpdate(post._id, { $inc: { bookmarkCount: -1 } });
    res.status(200).json({ bookmarked: false, bookmarkCount: Math.max(0, post.bookmarkCount - 1) });
  } else {
    await Like.create({ user: req.user._id, post: post._id, type: 'bookmark' });
    await Post.findByIdAndUpdate(post._id, { $inc: { bookmarkCount: 1 } });
    res.status(200).json({ bookmarked: true, bookmarkCount: post.bookmarkCount + 1 });
  }
}

export default runHandler(handler);
