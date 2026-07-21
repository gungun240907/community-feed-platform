import runHandler from '../../../../lib/handler.js';
import { optionalAuth } from '../../../../lib/middleware/auth.js';
import User from '../../../../lib/models/User.js';
import Follower from '../../../../lib/models/Follower.js';

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

export default runHandler((req, res, next) => {
  optionalAuth(req, res, () => getFollowers(req, res, next));
});
