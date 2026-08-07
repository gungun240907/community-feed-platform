const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const LoginLog = require('../models/LoginLog');
const {
  generateToken,
  setAuthCookie,
  getClientIp,
} = require('../middleware/auth');
const { parseUserAgent, generateDeviceFingerprint } = require('../utils/userAgentParser');
const { getIpLocation } = require('../utils/ipLocation');
const { verifyFirebaseIdToken } = require('../utils/firebaseAdmin');

const SESSION_DURATION_MS = parseInt(process.env.SESSION_DURATION_MS || (7 * 24 * 60 * 60 * 1000));

/** Phone-only accounts get a stable, unique placeholder email (schema requires one). */
function placeholderEmail(uid) {
  return `${uid}@phone.devfeed.local`;
}

function normalizePhone(phoneNumber) {
  if (!phoneNumber) return null;
  return String(phoneNumber).replace(/\D/g, '');
}

/**
 * Derive a unique lowercase username (3-30 chars) for a phone-only account.
 * Prefers the Firebase display name when it is usable, else the tail of the
 * phone number. A random suffix guarantees uniqueness on collision.
 */
async function generateUniqueUsername(name, phoneNumber) {
  const sanitize = (s) => String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30);

  let base = sanitize(name) || `user${String(phoneNumber || '').replace(/\D/g, '').slice(-6)}`;
  if (base.length < 3) base = `user${base}`;

  let username = base;
  while (await User.exists({ username })) {
    username = `${base}${crypto.randomBytes(2).toString('hex')}`.slice(0, 30);
  }
  return username;
}

/**
 * POST /api/auth/firebase-login
 * Body: { idToken }  — a Firebase ID token produced by the client SDK after
 * the user verified their phone via SMS OTP. The token is verified here with
 * the Firebase Admin SDK; the client is never trusted.
 */
async function firebaseLogin(req, res, next) {
  try {
    const { idToken } = req.validated;

    const decoded = await verifyFirebaseIdToken(idToken);

    const normalizedPhone = normalizePhone(decoded.phoneNumber);

    let user = await User.findOne({ firebaseUid: decoded.uid });
    if (!user && normalizedPhone) {
      user = await User.findOne({ phone: { $in: [decoded.phoneNumber, normalizedPhone] } });
    }

    let created = false;
    if (!user) {
      if (!normalizedPhone) {
        return res.status(400).json({ error: 'Firebase token has no verified phone number.' });
      }

      const username = await generateUniqueUsername(decoded.name, normalizedPhone);
      user = await User.create({
        username,
        email: placeholderEmail(decoded.uid),
        phone: decoded.phoneNumber,
        displayName: decoded.name || null,
        avatar: decoded.picture || '',
        firebaseUid: decoded.uid,
        isVerified: true,
      });
      created = true;
    } else {
      // Link the firebase identity if this account was reached via phone match.
      if (!user.firebaseUid) {
        user.firebaseUid = decoded.uid;
      }
      user.isVerified = true;
      if (decoded.phoneNumber && !user.phone) {
        user.phone = decoded.phoneNumber;
      }
    }

    user.lastLogin = new Date();
    await user.save();

    const sessionId = crypto.randomBytes(24).toString('hex');
    const token = generateToken(user._id, sessionId);

    const ua = req.headers['user-agent'] || '';
    const ip = getClientIp(req);
    const acceptLang = req.headers['accept-language'] || '';
    const parsedUA = parseUserAgent(ua);
    const fingerprint = generateDeviceFingerprint(ua, ip, acceptLang);
    const location = await getIpLocation(ip);

    await Session.create({
      user: user._id,
      sessionId,
      browser: parsedUA.browser,
      os: parsedUA.os,
      deviceType: parsedUA.deviceType,
      deviceFingerprint: fingerprint,
      ip,
      location,
      lastActiveAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
      isTrusted: true,
      loginMethod: 'firebase',
    });

    await LoginLog.create({
      user: user._id,
      browser: parsedUA.browser,
      os: parsedUA.os,
      deviceType: parsedUA.deviceType,
      ip,
      location,
      method: 'firebase_phone',
      success: true,
    });

    setAuthCookie(res, token);

    res.status(created ? 201 : 200).json({ user: user.toJSON(), token, created });
  } catch (error) {
    next(error);
  }
}

module.exports = { firebaseLogin };
