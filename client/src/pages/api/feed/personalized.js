import runHandler from '../../../lib/handler.js';
import Post from '../../../lib/models/Post.js';
import Follower from '../../../lib/models/Follower.js';
import Like from '../../../lib/models/Like.js';
import { authenticate } from '../../../lib/middleware/auth.js';

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
  await applyMiddleware(req, res, authenticate);
  if (!req.user) return;

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  const hashtag = req.query.hashtag;

  let filter = { isDeleted: false };

  if (hashtag) {
    filter.hashtags = hashtag.toLowerCase();
  } else if (req.user) {
    const following = await Follower.find({ follower: req.user._id }).select('following');
    const followingIds = following.map((f) => f.following);
    followingIds.push(req.user._id);
    filter.author = { $in: followingIds };
  }

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .populate('author', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Post.countDocuments(filter),
  ]);

  const enriched = await enrichPostsWithUserState(posts, req.user);

  res.status(200).json({
    posts: enriched,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + posts.length < total,
    },
  });
}

export default runHandler(handler);
