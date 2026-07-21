import runHandler from '../../../../lib/handler.js';
import { authenticate } from '../../../../lib/middleware/auth.js';
import Notification from '../../../../lib/models/Notification.js';

async function markAsRead(req, res, next) {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ notification });
  } catch (error) {
    next(error);
  }
}

export default runHandler((req, res, next) => {
  if (req.method === 'PUT') {
    return authenticate(req, res, () => markAsRead(req, res, next));
  }
  res.status(405).json({ error: 'Method not allowed' });
});
