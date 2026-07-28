const Post = require('../models/Post');
const Follower = require('../models/Follower');
const { calculateBulkScores } = require('../utils/engagementScore');
const Like = require('../models/Like');

async function getPersonalizedFeed(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const hashtag = req.query.hashtag;

    let filter = { isDeleted: false };

    if (hashtag) {
      filter.hashtags = hashtag.toLowerCase();
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

    res.json({
      posts: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + posts.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getTrendingFeed(req, res, next) {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

    let posts = await Post.find({ isDeleted: false })
      .populate('author', 'username displayName avatar featuredProfile')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const scored = calculateBulkScores(posts);
    scored.forEach((post) => {
      if (post.author && post.author.featuredProfile) {
        post.engagementScore *= 1.2;
      }
    });
    scored.sort((a, b) => b.engagementScore - a.engagementScore);

    const topPosts = scored.slice(0, limit);
    const enriched = await enrichPostsWithUserState(topPosts, req.user);

    res.json({ posts: enriched });
  } catch (error) {
    next(error);
  }
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

module.exports = { getPersonalizedFeed, getTrendingFeed };
