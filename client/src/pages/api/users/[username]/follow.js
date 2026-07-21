import runHandler from '../../../../lib/handler.js';
import { authenticate } from '../../../../lib/middleware/auth.js';
import User from '../../../../lib/models/User.js';
import Follower from '../../../../lib/models/Follower.js';
import Notification from '../../../../lib/models/Notification.js';

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

export default runHandler((req, res, next) => {
  authenticate(req, res, () => {
    if (req.method === 'POST') return followUser(req, res, next);
    if (req.method === 'DELETE') return unfollowUser(req, res, next);
    res.status(405).json({ error: 'Method not allowed' });
  });
});
