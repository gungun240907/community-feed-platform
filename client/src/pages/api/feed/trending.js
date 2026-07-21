import runHandler from '../../../lib/handler.js';
import Post from '../../../lib/models/Post.js';
import Like from '../../../lib/models/Like.js';
import { optionalAuth } from '../../../lib/middleware/auth.js';
import { calculateBulkScores } from '../../../lib/utils/engagementScore.js';

function applyMiddleware(req, res, fn) {
  return new Promise((resolve) => {
    fn(req, res, () => resolve());
    resolve();
  });
}

async function enrichPostsWithUserState(posts, user) {
  if (!user || !posts.length) return posts;

  const postIds = posts.map((p) => p._id);
  const [userLikes, userBookmarks] = await Promise.all([
    Like.find({ user: user._id, post: { $in: postIds }, type: 'like' }).select('post').lean(),
    Like.find({ user: user._id, post: { $in: postIds }, type: 'bookmark' }).select('post').lean(),
  ]);

  const likedSet = new Set(userLikes.map((l) => l.post.toString()));
  const bookmarkedSet = new Set(userBookmarks.map((b) => b.post.toString()));

  return posts.map((post) => ({
    ...post,
    isLiked: likedSet.has(post._id.toString()),
    isBookmarked: bookmarkedSet.has(post._id.toString()),
  }));
}

async function handler(req, res) {
  await applyMiddleware(req, res, optionalAuth);

  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  let posts = await Post.find({ isDeleted: false })
    .populate('author', 'username displayName avatar')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const scored = calculateBulkScores(posts);
  scored.sort((a, b) => b.engagementScore - a.engagementScore);

  const topPosts = scored.slice(0, limit);
  const enriched = await enrichPostsWithUserState(topPosts, req.user);

  res.status(200).json({ posts: enriched });
}

export default runHandler(handler);
