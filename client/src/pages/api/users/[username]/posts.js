import runHandler from '../../../../lib/handler.js';
import { optionalAuth } from '../../../../lib/middleware/auth.js';
import User from '../../../../lib/models/User.js';
import Post from '../../../../lib/models/Post.js';
import Like from '../../../../lib/models/Like.js';

async function getUserPosts(req, res, next) {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find({ author: user._id, isDeleted: false })
        .populate('author', 'username displayName avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments({ author: user._id, isDeleted: false }),
    ]);

    let enriched = posts;
    if (req.user) {
      const postIds = posts.map((p) => p._id);
      const [userLikes, userBookmarks] = await Promise.all([
        Like.find({ user: req.user._id, post: { $in: postIds }, type: 'like' }).select('post').lean(),
        Like.find({ user: req.user._id, post: { $in: postIds }, type: 'bookmark' }).select('post').lean(),
      ]);
      const likedSet = new Set(userLikes.map((l) => l.post.toString()));
      const bookmarkedSet = new Set(userBookmarks.map((b) => b.post.toString()));
      enriched = posts.map((post) => ({
        ...post,
        isLiked: likedSet.has(post._id.toString()),
        isBookmarked: bookmarkedSet.has(post._id.toString()),
      }));
    }

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

export default runHandler((req, res, next) => {
  optionalAuth(req, res, () => getUserPosts(req, res, next));
});
