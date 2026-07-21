import runHandler from '../../../lib/handler.js';
import Post from '../../../lib/models/Post.js';
import Notification from '../../../lib/models/Notification.js';
import mongoose from 'mongoose';
import { authenticate } from '../../../lib/middleware/auth.js';
import { extractHashtags, extractMentions } from '../../../lib/utils/hashtagExtractor.js';

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

  const { content, mediaUrls } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Post content is required' });
  }

  const hashtags = extractHashtags(content);
  const mentions = extractMentions(content);

  const post = await Post.create({
    author: req.user._id,
    content,
    mediaUrls: mediaUrls || [],
    hashtags,
    mentions,
  });

  const populated = await post.populate('author', 'username displayName avatar');

  if (mentions.length > 0) {
    const mentionedUsers = await mongoose.model('User').find({ username: { $in: mentions } });
    const notifications = mentionedUsers
      .filter((u) => u._id.toString() !== req.user._id.toString())
      .map((u) => ({
        recipient: u._id,
        sender: req.user._id,
        type: 'mention',
        post: post._id,
      }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  }

  res.status(201).json({ post: populated });
}

export default runHandler(handler);
