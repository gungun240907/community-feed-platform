const User = require('../models/User');
const Post = require('../models/Post');
const Like = require('../models/Like');
const Follower = require('../models/Follower');
const Notification = require('../models/Notification');

async function getProfile(req, res, next) {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let isFollowing = false;
    if (req.user && req.user._id.toString() !== user._id.toString()) {
      const followDoc = await Follower.findOne({ follower: req.user._id, following: user._id });
      isFollowing = !!followDoc;
    }

    res.json({ profile: { ...user.toJSON(), isFollowing } });
  } catch (error) {
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { displayName, bio, avatar } = req.body;
    const updates = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (bio !== undefined) updates.bio = bio;
    if (avatar !== undefined) updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

async function followUser(req, res, next) {
  try {
    const userToFollow = await User.findOne({ username: req.params.username });
    if (!userToFollow) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.user._id.toString() === userToFollow._id.toString()) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    await Follower.follow(req.user._id, userToFollow._id);

    await Notification.create({
      recipient: userToFollow._id,
      sender: req.user._id,
      type: 'follow',
    });

    const io = req.app.get('io');
    if (io) {
      io.to(userToFollow._id.toString()).emit('notification', {
        type: 'follow',
        sender: { _id: req.user._id, username: req.user.username },
      });
    }

    res.json({ message: `Now following @${userToFollow.username}` });
  } catch (error) {
    if (error.message === 'Already following this user') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
}

async function unfollowUser(req, res, next) {
  try {
    const userToUnfollow = await User.findOne({ username: req.params.username });
    if (!userToUnfollow) {
      return res.status(404).json({ error: 'User not found' });
    }

    await Follower.unfollow(req.user._id, userToUnfollow._id);
    res.json({ message: `Unfollowed @${userToUnfollow.username}` });
  } catch (error) {
    if (error.message === 'Not following this user') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
}

async function getFollowers(req, res, next) {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const followers = await Follower.find({ following: user._id })
      .populate('follower', 'username displayName avatar bio')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ followers: followers.map((f) => f.follower) });
  } catch (error) {
    next(error);
  }
}

async function getFollowing(req, res, next) {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const following = await Follower.find({ follower: user._id })
      .populate('following', 'username displayName avatar bio')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ following: following.map((f) => f.following) });
  } catch (error) {
    next(error);
  }
}

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

module.exports = { getProfile, updateProfile, followUser, unfollowUser, getFollowers, getFollowing, getUserPosts };
