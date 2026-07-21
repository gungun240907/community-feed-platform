import runHandler from '../../../../lib/handler.js';
import Post from '../../../../lib/models/Post.js';
import Like from '../../../../lib/models/Like.js';
import Notification from '../../../../lib/models/Notification.js';
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
    type: 'like',
  });

  if (existing) {
    await Like.deleteOne({ _id: existing._id });
    await Post.findByIdAndUpdate(post._id, { $inc: { likeCount: -1 } });

    res.status(200).json({ liked: false, likeCount: Math.max(0, post.likeCount - 1) });
  } else {
    await Like.create({ user: req.user._id, post: post._id, type: 'like' });
    await Post.findByIdAndUpdate(post._id, { $inc: { likeCount: 1 } });

    if (post.author.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: post.author,
        sender: req.user._id,
        type: 'like',
        post: post._id,
      });
    }

    res.status(200).json({ liked: true, likeCount: post.likeCount + 1 });
  }
}

export default runHandler(handler);
