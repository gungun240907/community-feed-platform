const LoginLog = require('../models/LoginLog');

async function getLoginHistory(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };

    const [logs, total] = await Promise.all([
      LoginLog.find(filter)
        .select('browser os deviceType ip location method success failureReason createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LoginLog.countDocuments(filter),
    ]);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + logs.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getAllLoginLogs(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.userId) filter.user = req.query.userId;
    if (req.query.success !== undefined) filter.success = req.query.success === 'true';

    const [logs, total] = await Promise.all([
      LoginLog.find(filter)
        .populate('user', 'username displayName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LoginLog.countDocuments(filter),
    ]);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + logs.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getLoginHistory, getAllLoginLogs };
