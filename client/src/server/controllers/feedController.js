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

    const following = await Follower.find({ follower: req.user._id }).select('following -_id').lean();
    const followingIds = following.map(f => f.following);
    followingIds.push(req.user._id);

    let filter = { isDeleted: false, author: { $in: followingIds } };

    if (hashtag) {
      filter.hashtags = hashtag.toLowerCase();
    }

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate('author', 'username displayName avatar')
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments(filter),
    ]);

    if (posts.length === 0 && !hashtag) {
      const [fallbackPosts, fallbackTotal] = await Promise.all([
        Post.find({ isDeleted: false })
          .populate('author', 'username displayName avatar')
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Post.countDocuments({ isDeleted: false }),
      ]);
      const enriched = await enrichPostsWithUserState(fallbackPosts, req.user);
      return res.json({
        posts: enriched,
        pagination: {
          page, limit, total: fallbackTotal,
          totalPages: Math.ceil(fallbackTotal / limit),
          hasMore: skip + fallbackPosts.length < fallbackTotal,
        },
      });
    }

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
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    let posts = await Post.find({ isDeleted: false })
      .populate('author', 'username displayName avatar featuredProfile')
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean();

    const scored = calculateBulkScores(posts);
    scored.forEach((post) => {
      if (post.author && post.author.featuredProfile) {
        post.engagementScore *= 1.2;
      }
    });
    scored.sort((a, b) => {
      if (b.engagementScore !== a.engagementScore) return b.engagementScore - a.engagementScore;
      return String(b._id).localeCompare(String(a._id));
    });

    const topPosts = scored.slice(skip, skip + limit);
    const enriched = await enrichPostsWithUserState(topPosts, req.user);

    res.json({
      posts: enriched,
      pagination: {
        page,
        limit,
        total: scored.length,
        totalPages: Math.ceil(scored.length / limit),
        hasMore: skip + topPosts.length < scored.length,
      },
    });
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
