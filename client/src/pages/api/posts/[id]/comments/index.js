import runHandler from '../../../../../lib/handler.js';
import Post from '../../../../../lib/models/Post.js';
import Comment from '../../../../../lib/models/Comment.js';
import Notification from '../../../../../lib/models/Notification.js';
import { authenticate, optionalAuth } from '../../../../../lib/middleware/auth.js';

function applyMiddleware(req, res, fn) {
  return new Promise((resolve) => {
    fn(req, res, () => resolve());
    resolve();
  });
}

async function getCommentsHandler(req, res) {
  await applyMiddleware(req, res, optionalAuth);

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  const filter = { post: req.params.id, isDeleted: false, parentComment: null };

  const [comments, total] = await Promise.all([
    Comment.find(filter)
      .populate('author', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Comment.countDocuments(filter),
  ]);

  const commentIds = comments.map((c) => c._id);
  const replies = await Comment.find({ parentComment: { $in: commentIds }, isDeleted: false })
    .populate('author', 'username displayName avatar')
    .sort({ createdAt: 1 })
    .lean();

  const replyMap = {};
  replies.forEach((reply) => {
    const key = reply.parentComment.toString();
    if (!replyMap[key]) replyMap[key] = [];
    replyMap[key].push(reply);
  });

  const enriched = comments.map((c) => ({
    ...c,
    replies: replyMap[c._id.toString()] || [],
  }));

  res.status(200).json({
    comments: enriched,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: skip + comments.length < total },
  });
}

async function createCommentHandler(req, res) {
  await applyMiddleware(req, res, authenticate);
  if (!req.user) return;

  const { text, parentCommentId } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comment text is required' });
  }

  const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  let depth = 0;
  let parentComment = null;

  if (parentCommentId) {
    parentComment = await Comment.findById(parentCommentId);
    if (!parentComment || parentComment.isDeleted) {
      return res.status(404).json({ error: 'Parent comment not found' });
    }
    depth = Math.min(parentComment.depth + 1, 3);
  }

  const comment = await Comment.create({
    post: post._id,
    author: req.user._id,
    text,
    parentComment: parentCommentId || null,
    depth,
  });

  await Post.findByIdAndUpdate(post._id, { $inc: { commentCount: 1 } });

  const populated = await comment.populate('author', 'username displayName avatar');

  if (post.author.toString() !== req.user._id.toString()) {
    await Notification.create({
      recipient: post.author,
      sender: req.user._id,
      type: parentCommentId ? 'reply' : 'comment',
      post: post._id,
      comment: comment._id,
    });
  }

  res.status(201).json({ comment: populated });
}

async function handler(req, res) {
  switch (req.method) {
    case 'GET':
      return getCommentsHandler(req, res);
    case 'POST':
      return createCommentHandler(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

export default runHandler(handler);
