import runHandler from '../../../../../lib/handler.js';
import { authenticate } from '../../../../../lib/middleware/auth.js';
import { requireAdmin } from '../../../../../lib/middleware/admin.js';
import User from '../../../../../lib/models/User.js';

async function suspendUser(req, res, next) {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot suspend another admin' });
    }

    user.status = 'suspended';
    await user.save();

    const io = req.app.get('io');
    if (io) {
      io.to(userId).emit('accountSuspended', { reason: 'Your account has been suspended by an administrator.' });
    }

    res.json({ message: 'User suspended', user: { _id: user._id, username: user.username, status: user.status } });
  } catch (error) {
    next(error);
  }
}

export default runHandler((req, res, next) => {
  if (req.method === 'PUT') {
    return authenticate(req, res, () => {
      requireAdmin(req, res, () => suspendUser(req, res, next));
    });
  }
  res.status(405).json({ error: 'Method not allowed' });
});
