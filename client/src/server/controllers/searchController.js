const Post = require("../models/Post");
const User = require("../models/User");
const Like = require("../models/Like");
const { getPlanConfig } = require("../utils/razorpay");

async function search(req, res, next) {
  try {
    const { q, postType, hashtag } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: "Query must be at least 2 characters" });
    }

    const VALID_TYPES = ['post', 'question', 'answer', 'showcase', 'achievement', 'snippet'];

    const query = q.trim();
    const regex = new RegExp(query.replace(/[.*+?^${}()|[]]/g, "$&"), "i");

    const plan = req.searchPlan || getPlanConfig('free');
    const searchTier = plan.search || 'basic';

    let userLimit, postLimit, postSort, includeHashtags;

    if (searchTier === 'highest') {
      userLimit = 10;
      postLimit = 20;
      postSort = { likeCount: -1, createdAt: -1 };
      includeHashtags = true;
    } else if (searchTier === 'advanced') {
      userLimit = 10;
      postLimit = 10;
      postSort = { createdAt: -1 };
      includeHashtags = true;
    } else {
      userLimit = 3;
      postLimit = 5;
      postSort = { createdAt: -1 };
      includeHashtags = false;
    }

    const userQuery = User.find({
      $or: [{ username: regex }, { displayName: regex }],
      status: "active",
    }).select("username displayName avatar bio followersCount featuredProfile badge").limit(userLimit);

    if (searchTier === 'highest' || searchTier === 'advanced') {
      userQuery.sort({ featuredProfile: -1, followersCount: -1 });
    }

    const users = await userQuery.lean();

    const postFilter = includeHashtags
      ? { $or: [{ content: regex }, { hashtags: { $in: [query.toLowerCase()] } }] }
      : { content: regex };

    if (hashtag && typeof hashtag === 'string' && hashtag.trim()) {
      postFilter.hashtags = hashtag.trim().toLowerCase().replace(/^#/, '');
    }
    if (postType && VALID_TYPES.includes(postType)) {
      postFilter.postType = postType;
    }

    const posts = await Post.find({
      ...postFilter,
      isDeleted: { $ne: true },
    }).populate("author", "username displayName avatar").sort(postSort).limit(postLimit).lean();

    const userId = req.user?._id;
    let enrichedPosts = posts;
    if (userId) {
      const postIds = posts.map(p => p._id);
      const [userLikes, userBookmarks] = await Promise.all([
        Like.find({ user: userId, type: "like", post: { $in: postIds } }).lean(),
        Like.find({ user: userId, type: "bookmark", post: { $in: postIds } }).lean(),
      ]);
      const likedSet = new Set(userLikes.map(l => l.post.toString()));
      const bookmarkedSet = new Set(userBookmarks.map(b => b.post.toString()));
      enrichedPosts = posts.map(post => ({
        ...post,
        isLiked: likedSet.has(post._id.toString()),
        isBookmarked: bookmarkedSet.has(post._id.toString()),
      }));
    }

    res.json({ users, posts: enrichedPosts, searchTier });
  } catch (error) {
    next(error);
  }
}

module.exports = { search };