const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const SESSION_ABSOLUTE_MS = parseInt(process.env.SESSION_DURATION_MS || (30 * 24 * 60 * 60 * 1000));
const SESSION_INACTIVE_TIMEOUT_MS = parseInt(process.env.SESSION_INACTIVE_TIMEOUT_MS || (7 * 24 * 60 * 60 * 1000));

function generateToken(userId, sessionId) {
  const seconds = Math.floor(SESSION_ABSOLUTE_MS / 1000);
  return jwt.sign({ id: userId, sessionId }, JWT_SECRET, { expiresIn: seconds });
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
}

function getClientIp(req) {
  // Only honor X-Forwarded-For when the app is explicitly run behind a trusted
  // reverse proxy. Otherwise an attacker could spoof the header to rotate their
  // rate-limit key and evade login/OTP brute-force protection.
  const trustProxy = req.app && typeof req.app.get === 'function' && req.app.get('trust proxy');
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '';
}

async function authenticate(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended' });
    }

    if (decoded.sessionId) {
      const session = await Session.findOne({ sessionId: decoded.sessionId, isRevoked: false });
      if (!session) {
        return res.status(401).json({ error: 'Session expired or revoked. Please login again.' });
      }

      if (session.expiresAt < new Date()) {
        session.isRevoked = true;
        await session.save();
        return res.status(401).json({ error: 'Session expired. Please login again.' });
      }

      if (Date.now() - session.lastActiveAt.getTime() > SESSION_INACTIVE_TIMEOUT_MS) {
        session.isRevoked = true;
        await session.save();
        return res.status(401).json({ error: 'Session inactive for too long. Please login again.' });
      }

      session.lastActiveAt = new Date();
      await session.save();

      req.session = session;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    next(error);
  }
}

async function optionalAuth(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    req.user = user && user.status === 'active' ? user : null;
    next();
  } catch {
    req.user = null;
    next();
  }
}

module.exports = { authenticate, optionalAuth, generateToken, JWT_SECRET, getClientIp, SESSION_INACTIVE_TIMEOUT_MS };
