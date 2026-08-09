const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const LoginLog = require('../models/LoginLog');
const { generateToken, getClientIp } = require('../middleware/auth');
const { generatePassword } = require('../utils/passwordGenerator');
const { parseUserAgent, generateDeviceFingerprint } = require('../utils/userAgentParser');
const { getIpLocation } = require('../utils/ipLocation');
const { sendNewDeviceLoginAlert, sendPasswordResetEmail } = require('../utils/emailService');
const { createAndSendOtp, verifyOtp } = require('../utils/otpService');

const SESSION_DURATION_MS = parseInt(process.env.SESSION_DURATION_MS || (7 * 24 * 60 * 60 * 1000));
const MAX_ACTIVE_SESSIONS = parseInt(process.env.MAX_ACTIVE_SESSIONS || 20);

async function register(req, res, next) {
  try {
    const { username, email, password, displayName, phone } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { username: username.toLowerCase() }],
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      return res.status(409).json({ error: `User with this ${field} already exists` });
    }

    const user = await User.create({ username, email, password, displayName, phone });

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
      loginMethod: 'password',
    });

    res.status(201).json({ user, token });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    const user = await User.findOne({
      $or: [{ email: login.toLowerCase().trim() }, { username: login.toLowerCase().trim() }],
    }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended. Contact an administrator.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ua = req.headers['user-agent'] || '';
    const ip = getClientIp(req);
    const acceptLang = req.headers['accept-language'] || '';
    const parsedUA = parseUserAgent(ua);
    const fingerprint = generateDeviceFingerprint(ua, ip, acceptLang);
    const location = await getIpLocation(ip);

    const knownSession = await Session.findOne({
      user: user._id,
      deviceFingerprint: fingerprint,
      isRevoked: false,
      isTrusted: true,
    });

    const totalActiveSessions = await Session.countDocuments({ user: user._id, isRevoked: false });

    if (knownSession || totalActiveSessions === 0) {
      const sessionId = crypto.randomBytes(24).toString('hex');
      const token = generateToken(user._id, sessionId);

      const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
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
        expiresAt,
        isTrusted: true,
        loginMethod: 'trusted_device',
      });

      await LoginLog.create({
        user: user._id,
        browser: parsedUA.browser,
        os: parsedUA.os,
        deviceType: parsedUA.deviceType,
        ip,
        location,
        method: 'trusted_device',
        success: true,
      });

      const userObj = user.toJSON();
      return res.json({ user: userObj, token, sessionCreated: true });
    }

    // Unknown device: require email OTP before issuing a session.
    // createAndSendOtp hashes the code, enforces a resend cooldown and only
    // delivers it to the registered email address.
    await createAndSendOtp({
      user,
      purpose: 'login_verification',
      type: 'email',
      ip,
    });

    res.json({
      requiresOtp: true,
      message: 'OTP sent to your email for new device verification.',
      retryAfterMs: 0,
      deviceInfo: {
        browser: parsedUA.browser,
        os: parsedUA.os,
        deviceType: parsedUA.deviceType,
        ip,
        location: location.raw,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Re-send the new-device login OTP.
 * Credentials are re-verified so this endpoint cannot be abused to spam OTPs
 * without the user's password. The resend cooldown from otpService still applies.
 */
async function resendLoginOtp(req, res, next) {
  try {
    const { login, password } = req.validated;

    const user = await User.findOne({
      $or: [{ email: login.toLowerCase().trim() }, { username: login.toLowerCase().trim() }],
    }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const result = await createAndSendOtp({
      user,
      purpose: 'login_verification',
      type: 'email',
      ip: getClientIp(req),
    });

    res.json({
      requiresOtp: true,
      message: 'A new OTP has been sent to your email.',
      retryAfterMs: result.retryAfterMs,
    });
  } catch (error) {
    next(error);
  }
}

async function verifyLoginOtp(req, res, next) {
  try {
    const { login, password, otp, trustDevice } = req.body;

    if (!login || !password || !otp) {
      return res.status(400).json({ error: 'Username/email, password, and OTP are required' });
    }

    const user = await User.findOne({
      $or: [{ email: login.toLowerCase().trim() }, { username: login.toLowerCase().trim() }],
    }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify the OTP via the hardened service (hashed compare, attempt caps,
    // atomic one-time consumption). The code is never compared in plaintext.
    const otpResult = await verifyOtp({
      userId: user._id,
      purpose: 'login_verification',
      code: otp,
    });

    if (!otpResult.valid) {
      const status = otpResult.code === 'LOCKED' ? 429 : 400;
      return res.status(status).json({
        error: otpResult.error,
        code: otpResult.code,
        ...(typeof otpResult.remaining === 'number' ? { attemptsRemaining: otpResult.remaining } : {}),
      });
    }

    const ua = req.headers['user-agent'] || '';
    const ip = getClientIp(req);
    const acceptLang = req.headers['accept-language'] || '';
    const parsedUA = parseUserAgent(ua);
    const fingerprint = generateDeviceFingerprint(ua, ip, acceptLang);
    const location = await getIpLocation(ip);

    const sessionId = crypto.randomBytes(24).toString('hex');
    const token = generateToken(user._id, sessionId);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    const activeSessions = await Session.countDocuments({ user: user._id, isRevoked: false });
    if (activeSessions >= MAX_ACTIVE_SESSIONS) {
      const oldest = await Session.findOne({ user: user._id, isRevoked: false }).sort({ lastActiveAt: 1 });
      if (oldest) {
        oldest.isRevoked = true;
        await oldest.save();
      }
    }

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
      expiresAt,
      isTrusted: !!trustDevice,
      loginMethod: 'otp',
    });

    await LoginLog.create({
      user: user._id,
      browser: parsedUA.browser,
      os: parsedUA.os,
      deviceType: parsedUA.deviceType,
      ip,
      location,
      method: 'otp',
      success: true,
    });

    try {
      await sendNewDeviceLoginAlert(user, {
        browser: parsedUA.browser,
        os: parsedUA.os,
        deviceType: parsedUA.deviceType,
        ip,
        location: location.raw,
      });
    } catch (e) {
      console.error('Failed to send new device alert:', e.message);
    }

    const userObj = user.toJSON();
    res.json({ user: userObj, token, sessionCreated: true });
  } catch (error) {
    next(error);
  }
}

async function getMe(req, res, next) {
  try {
    res.json({ user: req.user });
  } catch (error) {
    next(error);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email, phone } = req.body;

    if ((!email || !email.trim()) && (!phone || !phone.trim())) {
      return res.status(400).json({ error: 'Email or phone number is required' });
    }

    let user;
    if (email && email.trim()) {
      user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    } else if (phone && phone.trim()) {
      user = await User.findOne({ phone: phone.trim() }).select('+password');
    }

    // OWASP: never reveal whether an account exists. Return the same generic
    // success message whether or not a user was found.
    if (!user) {
      return res.json({
        message: 'If an account matches that information, a new password has been sent.',
      });
    }

    // TODO: SMS delivery was removed with MSG91. Phone-based password reset
    // is disabled until a new SMS provider is added. Keep anti-enumeration.
    if (!email || !email.trim()) {
      return res.json({
        message: 'If an account matches that information, a new password has been sent.',
      });
    }

    const now = new Date();
    if (user.lastPasswordResetRequest) {
      const lastRequest = new Date(user.lastPasswordResetRequest);
      const isSameDay =
        lastRequest.getFullYear() === now.getFullYear() &&
        lastRequest.getMonth() === now.getMonth() &&
        lastRequest.getDate() === now.getDate();

      if (isSameDay) {
        return res.status(429).json({
          error: 'You can use this option only one time per day.',
        });
      }
    }

    const newPassword = generatePassword();

    const delivered = await sendPasswordResetEmail(user, newPassword);

    if (!delivered) {
      return res.status(503).json({ error: 'Unable to deliver the new password. Please try again later.' });
    }

    user.password = newPassword;
    user.lastPasswordResetRequest = now;
    await user.save();

    res.json({
      message: 'A new password has been sent to your registered email.',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, verifyLoginOtp, resendLoginOtp, getMe, forgotPassword };
