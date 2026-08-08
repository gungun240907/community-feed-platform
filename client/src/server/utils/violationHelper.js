const User = require('../models/User');

const VIOLATION_THRESHOLD = parseInt(process.env.ADMIN_VIOLATION_SUSPEND_THRESHOLD || '3', 10);

async function recordAdminViolation(userId, io = null) {
  if (!userId || VIOLATION_THRESHOLD <= 0) return null;

  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { adminViolations: 1 } },
    { new: true }
  );

  if (!user || user.role === 'admin') return user;

  if (user.adminViolations >= VIOLATION_THRESHOLD && user.status !== 'suspended') {
    user.status = 'suspended';
    await user.save();
    if (io) {
      io.to(userId.toString()).emit('accountSuspended', {
        reason: 'Your account has been suspended for repeated content violations.',
      });
    }
  }

  return user;
}

module.exports = { recordAdminViolation, VIOLATION_THRESHOLD };