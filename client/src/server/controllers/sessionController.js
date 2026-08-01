const Session = require('../models/Session');

async function getActiveSessions(req, res, next) {
  try {
    const sessions = await Session.find({
      user: req.user._id,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    })
      .select('browser os deviceType ip location lastActiveAt createdAt expiresAt isTrusted loginMethod')
      .sort({ lastActiveAt: -1 })
      .lean();

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
}

async function revokeSession(req, res, next) {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({ sessionId, user: req.user._id });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.isRevoked) {
      return res.status(400).json({ error: 'Session already revoked' });
    }

    if (req.session && req.session.sessionId === sessionId) {
      return res.status(400).json({ error: 'Cannot revoke your current session. Use logout instead.' });
    }

    session.isRevoked = true;
    await session.save();

    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    next(error);
  }
}

async function trustDevice(req, res, next) {
  try {
    if (!req.session) {
      return res.status(400).json({ error: 'No active session found' });
    }

    req.session.isTrusted = true;
    await req.session.save();

    res.json({ message: 'Device trusted for future logins' });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    if (req.session) {
      req.session.isRevoked = true;
      await req.session.save();
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}

async function revokeAllSessions(req, res, next) {
  try {
    const sessionId = req.session ? req.session.sessionId : null;

    await Session.updateMany(
      { user: req.user._id, isRevoked: false, sessionId: { $ne: sessionId } },
      { isRevoked: true }
    );

    res.json({ message: 'All other sessions revoked' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getActiveSessions, revokeSession, trustDevice, logout, revokeAllSessions };
