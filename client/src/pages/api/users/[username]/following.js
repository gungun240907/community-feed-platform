import runHandler from '../../../../lib/handler.js';
import { optionalAuth } from '../../../../lib/middleware/auth.js';
import User from '../../../../lib/models/User.js';
import Follower from '../../../../lib/models/Follower.js';

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

export default runHandler((req, res, next) => {
  optionalAuth(req, res, () => getFollowing(req, res, next));
});
