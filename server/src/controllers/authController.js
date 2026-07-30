const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const LoginLog = require('../models/LoginLog');
const Otp = require('../models/Otp');
const { generateToken, getClientIp } = require('../middleware/auth');
const { generatePassword } = require('../utils/passwordGenerator');
const { parseUserAgent, generateDeviceFingerprint } = require('../utils/userAgentParser');
const { getIpLocation } = require('../utils/ipLocation');
const { sendNewDeviceLoginAlert } = require('../utils/emailService');
const { createAndSendOtp } = require('../utils/otpService');

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

    const io = req.app.get('io');
    await createAndSendOtp({
      user,
      purpose: 'login_verification',
      type: 'email',
      request: req,
      io,
    });

    const transport = require('nodemailer');
    let transporter = null;
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      transporter = transport.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
    }

    if (transporter) {
      const otpDoc = await Otp.findOne({
        user: user._id,
        purpose: 'login_verification',
        verified: false,
      }).sort({ createdAt: -1 });

      const otpCode = otpDoc ? otpDoc.code : 'N/A';
      await transporter.sendMail({
        from: `"DevFeed Security" <${process.env.SMTP_FROM || 'noreply@devfeed.com'}>`,
        to: user.email,
        subject: 'Verify your login from a new device',
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;text-align:center;">
          <h2>New Device Login Verification</h2>
          <p style="color:#6b7280;">We detected a login from a new device.</p>
          <div style="margin:24px 0;">
            <p style="font-size:14px;color:#374151;margin:4px 0;"><strong>Browser:</strong> ${parsedUA.browser}</p>
            <p style="font-size:14px;color:#374151;margin:4px 0;"><strong>OS:</strong> ${parsedUA.os}</p>
            <p style="font-size:14px;color:#374151;margin:4px 0;"><strong>IP:</strong> ${ip}</p>
            ${location.raw ? `<p style="font-size:14px;color:#374151;margin:4px 0;"><strong>Location:</strong> ${location.raw}</p>` : ''}
          </div>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f3f4f6;padding:16px;border-radius:12px;margin:16px 0;">${otpCode}</div>
          <p style="color:#6b7280;font-size:14px;">This code expires in 10 minutes.</p>
          <p style="color:#6b7280;font-size:14px;">If this wasn't you, please ignore this email.</p>
        </div>`,
      });
    }

    res.json({
      requiresOtp: true,
      message: 'OTP sent to your email for new device verification.',
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

    const otpDoc = await Otp.findOne({
      user: user._id,
      purpose: 'login_verification',
      verified: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      return res.status(400).json({ error: 'OTP expired or not found. Please login again.' });
    }

    if (otpDoc.code !== otp) {
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    }

    otpDoc.verified = true;
    await otpDoc.save();

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

    if (!user) {
      return res.status(404).json({ error: 'No account found with that information' });
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

    user.password = newPassword;
    user.lastPasswordResetRequest = now;
    await user.save();

    res.json({
      message: 'Password reset successfully',
      newPassword,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, verifyLoginOtp, getMe, forgotPassword };
