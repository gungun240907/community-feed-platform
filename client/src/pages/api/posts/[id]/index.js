import runHandler from '../../../../lib/handler.js';
import Post from '../../../../lib/models/Post.js';
import Like from '../../../../lib/models/Like.js';
import { authenticate, optionalAuth } from '../../../../lib/middleware/auth.js';
import { extractHashtags, extractMentions } from '../../../../lib/utils/hashtagExtractor.js';

function applyMiddleware(req, res, fn) {
  return new Promise((resolve) => {
    fn(req, res, () => resolve());
    resolve();
  });
}

async function getPostHandler(req, res) {
  await applyMiddleware(req, res, optionalAuth);

  const post = await Post.findOne({ _id: req.params.id, isDeleted: false })
    .populate('author', 'username displayName avatar')
    .lean();

  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  let isLiked = false;
  let isBookmarked = false;
  if (req.user) {
    const [likeDoc, bookmarkDoc] = await Promise.all([
      Like.findOne({ user: req.user._id, post: post._id, type: 'like' }).lean(),
      Like.findOne({ user: req.user._id, post: post._id, type: 'bookmark' }).lean(),
    ]);
    isLiked = !!likeDoc;
    isBookmarked = !!bookmarkDoc;
  }

  res.status(200).json({ post: { ...post, isLiked, isBookmarked } });
}

async function updatePostHandler(req, res) {
  await applyMiddleware(req, res, authenticate);
  if (!req.user) return;

  const { content, mediaUrls } = req.body;
  const post = await Post.findOne({ _id: req.params.id, isDeleted: false });

  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  if (post.author.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'You can only edit your own posts' });
  }

  if (content) {
    post.content = content;
    post.hashtags = extractHashtags(content);
    post.mentions = extractMentions(content);
  }
  if (mediaUrls) post.mediaUrls = mediaUrls;
  post.isEdited = true;

  await post.save();
  const populated = await post.populate('author', 'username displayName avatar');

  res.status(200).json({ post: populated });
}

async function deletePostHandler(req, res) {
  await applyMiddleware(req, res, authenticate);
  if (!req.user) return;

  const post = await Post.findOne({ _id: req.params.id, isDeleted: false });

  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized to delete this post' });
  }

  post.isDeleted = true;
  post.deletedAt = new Date();
  await post.save();

  res.status(200).json({ message: 'Post deleted successfully' });
}

async function handler(req, res) {
  switch (req.method) {
    case 'GET':
      return getPostHandler(req, res);
    case 'PUT':
      return updatePostHandler(req, res);
    case 'DELETE':
      return deletePostHandler(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

export default runHandler(handler);
