import runHandler from '../../../../../lib/handler.js';
import { authenticate } from '../../../../../lib/middleware/auth.js';
import { requireAdmin } from '../../../../../lib/middleware/admin.js';
import User from '../../../../../lib/models/User.js';

async function unsuspendUser(req, res, next) {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndUpdate(userId, { status: 'active' }, { new: true });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User unsuspended', user: { _id: user._id, username: user.username, status: user.status } });
  } catch (error) {
    next(error);
  }
}

export default runHandler((req, res, next) => {
  if (req.method === 'PUT') {
    return authenticate(req, res, () => {
      requireAdmin(req, res, () => unsuspendUser(req, res, next));
    });
  }
  res.status(405).json({ error: 'Method not allowed' });
});
