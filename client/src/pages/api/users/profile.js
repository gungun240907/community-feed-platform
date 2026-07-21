import runHandler from '../../../lib/handler.js';
import { authenticate } from '../../../lib/middleware/auth.js';
import User from '../../../lib/models/User.js';

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

export default runHandler((req, res, next) => {
  if (req.method === 'PUT') {
    return authenticate(req, res, () => updateProfile(req, res, next));
  }
  res.status(405).json({ error: 'Method not allowed' });
});
