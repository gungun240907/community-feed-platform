const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const LoginLog = require('../models/LoginLog');
const { generateToken, getClientIp } = require('../middleware/auth');
const { generatePassword } = require('../utils/passwordGenerator');
const { parseUserAgent, generateDeviceFingerprint } = require('../utils/userAgentParser');
const { getIpLocation } = require('../utils/ipLocation');
const { sendNewDeviceLoginAlert, sendPasswordResetEmail, sendPasswordResetSms } = require('../utils/emailService');
const { upsertCredentials, verifyCredential } = require('../utils/credentials');
const { normalizePhone } = require('../utils/phone');
const { createAndSendOtp, verifyOtp } = require('../utils/otpService');

// Absolute session/TToken lifetime. Must be >= the inactivity timeout in
// middleware/auth.js (SESSION_INACTIVE_TIMEOUT_MS) so that the "expire after
// inactivity" rule is actually reachable for active sessions.
const SESSION_DURATION_MS = parseInt(process.env.SESSION_DURATION_MS || (30 * 24 * 60 * 60 * 1000));
const MAX_ACTIVE_SESSIONS = parseInt(process.env.MAX_ACTIVE_SESSIONS || 20);

function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const visible = name.slice(0, 2);
  const masked = name.slice(2).replace(/./g, '*');
  return `${visible}${masked}@${domain}`;
}

/**
 * A device is "recognized" when the same fingerprint has previously produced a
 * trusted session or a successful login. Recognized devices skip the OTP
 * challenge; everything else is treated as unrecognized.
 */
async function isRecognizedDevice(userId, fingerprint) {
  if (!fingerprint) return false;
  if (await Session.exists({ user: userId, deviceFingerprint: fingerprint, isTrusted: true })) return true;
  return !!(await LoginLog.exists({ user: userId, deviceFingerprint: fingerprint, success: true }));
}

/**
 * Creates the session + login record for a successful authentication and
 * returns the signed token. `method` distinguishes password vs OTP logins.
 */
async function issueSession(user, parsedUA, fingerprint, ip, location, method) {
  const sessionId = crypto.randomBytes(24).toString('hex');
  const token = generateToken(user._id, sessionId);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  // Enforce the concurrent-session cap: when at the limit, revoke the oldest
  // still-active session so a user cannot accumulate unlimited live sessions.
  const now = new Date();
  const activeCount = await Session.countDocuments({
    user: user._id,
    isRevoked: false,
    expiresAt: { $gt: now },
  });
  if (activeCount >= MAX_ACTIVE_SESSIONS) {
    const oldest = await Session.find({
      user: user._id,
      isRevoked: false,
      expiresAt: { $gt: now },
    })
      .sort({ lastActiveAt: 1 })
      .limit(1);
    if (oldest[0]) {
      oldest[0].isRevoked = true;
      await oldest[0].save();
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
    isTrusted: true,
    loginMethod: method,
  });

  await LoginLog.create({
    user: user._id,
    browser: parsedUA.browser,
    os: parsedUA.os,
    deviceType: parsedUA.deviceType,
    deviceFingerprint: fingerprint,
    ip,
    location,
    method,
    success: true,
  });

  return { sessionId, token, expiresAt };
}

async function register(req, res, next) {
  try {
    const { username, email, password, displayName, phone } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Phone is mandatory at signup: it is the channel used to deliver the OTP
    // that verifies page-translation requests.
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({
        error: 'A valid phone number is required',
        code: 'VALIDATION_ERROR',
        fields: { phone: 'Invalid phone number' },
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { username: username.toLowerCase() }],
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      return res.status(409).json({ error: `User with this ${field} already exists` });
    }

    const user = await User.create({ username, email, password, displayName, phone: normalizedPhone });

    // Persist credentials in the separate credentials collection so login can
    // be checked against it. user.password holds the bcrypt hash after save.
    await upsertCredentials({
      userId: user._id,
      email: user.email,
      username: user.username,
      phone: user.phone,
      passwordHash: user.password,
    });

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
      return res.status(400).json({ error: 'Username/email/phone and password are required' });
    }

    // Check credentials against the separate credentials collection first.
    let userId = await verifyCredential(login, password);
    let user = userId ? await User.findById(userId) : null;

    // Fallback for accounts created before the credentials collection existed
    // (or test fixtures inserted directly via the model). Keeps legacy users
    // able to log in and lazily migrates them into the separate store.
    if (!user) {
      const identifier = String(login).trim().toLowerCase();
      const phoneNorm = normalizePhone(login);
      user = await User.findOne({
        $or: [
          { email: identifier },
          { username: identifier },
          { phone: phoneNorm || login },
        ],
      }).select('+password');

      if (user) {
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          user = null;
        } else {
          userId = user._id;
          await upsertCredentials({
            userId: user._id,
            email: user.email,
            username: user.username,
            phone: user.phone,
            passwordHash: user.password,
          });
        }
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended. Contact an administrator.' });
    }

    const ua = req.headers['user-agent'] || '';
    const ip = getClientIp(req);
    const acceptLang = req.headers['accept-language'] || '';
    const parsedUA = parseUserAgent(ua);
    const fingerprint = generateDeviceFingerprint(ua, ip, acceptLang);
    const location = await getIpLocation(ip);

    // Recognized devices log in directly. Unrecognized devices must confirm the
    // login via an email OTP before a session is issued ("remember trusted
    // devices for future logins").
    const recognized = await isRecognizedDevice(user._id, fingerprint);

    if (recognized) {
      const { token } = await issueSession(user, parsedUA, fingerprint, ip, location, 'password');
      const userObj = user.toJSON();
      return res.json({ user: userObj, token, sessionCreated: true });
    }

    // Unrecognized device: challenge with a login OTP sent to the registered email.
    try {
      const result = await createAndSendOtp({
        user,
        purpose: 'login_verification',
        type: 'email',
        ip,
      });
      return res.json({
        otpRequired: true,
        otpType: 'email',
        message: 'We sent a verification code to your email to confirm this new device.',
        contact: maskEmail(user.email),
        expiresInMs: result.expiresAt.getTime() - Date.now(),
      });
    } catch (otpErr) {
      // The OTP must be enforced in every environment. If it cannot be
      // delivered (e.g. SMTP unconfigured) we fail closed rather than letting a
      // new device sign in without the second factor.
      console.error('[auth] Failed to deliver login OTP:', otpErr.message);
      return res.status(503).json({ error: 'Unable to deliver the verification code. Please try again later.' });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Completes a login that was challenged because it came from an unrecognized
 * device. The client submits the same login identifier plus the OTP that was
 * emailed. On success a trusted session is issued and a new-device alert email
 * is sent (requirement: notify on new-device logins).
 */
async function verifyLogin(req, res, next) {
  try {
    const { login, otp } = req.body;

    if (!login || !otp) {
      return res.status(400).json({ error: 'Login identifier and OTP are required' });
    }

    const identifier = String(login).trim().toLowerCase();
    const phoneNorm = normalizePhone(login);
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier },
        { phone: phoneNorm || login },
      ],
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended. Contact an administrator.' });
    }

    const result = await verifyOtp({ userId: user._id, purpose: 'login_verification', code: otp });
    if (!result.valid) {
      const status = result.code === 'LOCKED' ? 429 : 400;
      return res.status(status).json({
        error: result.error,
        code: result.code,
        ...(typeof result.remaining === 'number' ? { attemptsRemaining: result.remaining } : {}),
      });
    }

    const ua = req.headers['user-agent'] || '';
    const ip = getClientIp(req);
    const acceptLang = req.headers['accept-language'] || '';
    const parsedUA = parseUserAgent(ua);
    const fingerprint = generateDeviceFingerprint(ua, ip, acceptLang);
    const location = await getIpLocation(ip);

    const { token } = await issueSession(user, parsedUA, fingerprint, ip, location, 'otp');

    // Notify the user that a login happened from a new device.
    try {
      await sendNewDeviceLoginAlert(user, {
        browser: parsedUA.browser,
        os: parsedUA.os,
        deviceType: parsedUA.deviceType,
        ip,
        location: location.raw,
      });
    } catch (e) {
      console.error('[auth] Failed to send new-device alert:', e.message);
    }

    const userObj = user.toJSON();
    return res.json({ user: userObj, token, sessionCreated: true, verified: true });
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

    // Enforce the once-per-day limit for BOTH email and phone resets.
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

    const channel = email && email.trim() ? 'email' : 'phone';
    const newPassword = generatePassword();

    // Deliver the new password via the requested channel. For phone-based
    // resets we attempt SMS first and fall back to email when no SMS provider
    // is configured, so the reset still completes.
    let delivered = false;
    if (channel === 'email') {
      delivered = await sendPasswordResetEmail(user, newPassword);
    } else {
      delivered = await sendPasswordResetSms(user, newPassword);
      if (!delivered) delivered = await sendPasswordResetEmail(user, newPassword);
    }

    if (!delivered) {
      return res.status(503).json({ error: 'Unable to deliver the new password. Please try again later.' });
    }

    user.password = newPassword;
    user.lastPasswordResetRequest = now;
    await user.save();

    // Keep the separate credentials collection in sync with the new password.
    await upsertCredentials({
      userId: user._id,
      email: user.email,
      username: user.username,
      phone: user.phone,
      passwordHash: user.password,
    });

    const response = {
      message:
        channel === 'email'
          ? 'A new password has been sent to your registered email.'
          : 'A new password has been sent to your registered mobile number.',
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, verifyLogin, getMe, forgotPassword };
