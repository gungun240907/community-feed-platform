import runHandler from '../../../../lib/handler.js';
import { optionalAuth } from '../../../../lib/middleware/auth.js';
import User from '../../../../lib/models/User.js';
import Follower from '../../../../lib/models/Follower.js';

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

export default runHandler((req, res, next) => {
  optionalAuth(req, res, () => getProfile(req, res, next));
});
