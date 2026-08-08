const crypto = require('crypto');
const Otp = require('../models/Otp');
const { sendSms, isTwilioConfigured, normalizePhoneNumber } = require('./twilioService');
const { sendOtpEmail } = require('./emailService');

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);
const OTP_RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10);

function generateOtpCode() {
  return crypto.randomInt(100000, 999999).toString();
}

function maskEmail(email) {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
}

function maskPhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  const prefix = phone.startsWith('+') ? '+' : '';
  return `${prefix}****${phone.slice(-4)}`;
}

async function createAndSendOtp({ user, purpose, type = 'email', request, io }) {
  const now = new Date();

  const lastOtp = await Otp.findOne({ user: user._id, purpose }).sort({ createdAt: -1 });
  if (lastOtp && lastOtp.createdAt && !lastOtp.verified && lastOtp.expiresAt > now) {
    const elapsedSeconds = (now - lastOtp.createdAt) / 1000;
    const remaining = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds);
    if (remaining > 0) {
      const error = new Error(`Please wait ${remaining}s before requesting another OTP.`);
      error.statusCode = 429;
      throw error;
    }
  }

  const code = generateOtpCode();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

  const contact = type === 'phone' ? user.phone : user.email;
  let delivery;

  if (type === 'phone') {
    const to = normalizePhoneNumber(contact);
    if (!to) {
      const error = new Error(
        'Phone number must be in international format (e.g. +919876543210). Please update your profile.'
      );
      error.statusCode = 400;
      throw error;
    }

    if (!isTwilioConfigured()) {
      const error = new Error('SMS delivery is not configured. Please ask an administrator to set up Twilio.');
      error.statusCode = 503;
      throw error;
    }

    await Otp.deleteMany({ user: user._id, purpose, verified: false });
    await Otp.create({
      user: user._id,
      code,
      type,
      purpose,
      expiresAt,
    });

    try {
      const result = await sendSms({
        to,
        body: `Your DevFeed verification code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share it with anyone.`,
      });
      delivery = { channel: 'sms', contact: maskPhone(to), sid: result.sid };
    } catch (error) {
      console.error(`[OTP] Twilio SMS send failed for ${user._id}:`, error.message);
      error.statusCode = error.statusCode || 502;
      throw error;
    }
  } else {
    let result;
    try {
      result = await sendOtpEmail({ to: contact, code, purpose });
    } catch (error) {
      console.error(`[OTP] Email OTP send failed for ${user._id}:`, error.message);
      error.statusCode = error.statusCode || 502;
      throw error;
    }

    if (!result.sent) {
      const error = new Error('Email delivery is not configured. Please ask an administrator to set up SMTP.');
      error.statusCode = 503;
      throw error;
    }

    await Otp.deleteMany({ user: user._id, purpose, verified: false });
    await Otp.create({
      user: user._id,
      code,
      type,
      purpose,
      expiresAt,
    });

    delivery = { channel: 'email', contact: maskEmail(contact) };
  }

  return delivery;
}

async function verifyOtp({ userId, purpose, code }) {
  if (!code || code.length !== 6) {
    return { valid: false, error: 'Invalid OTP' };
  }

  const otpDoc = await Otp.findOne({
    user: userId,
    purpose,
    verified: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    return { valid: false, error: 'OTP expired or not found. Please request a new one.' };
  }

  if (otpDoc.code !== code) {
    return { valid: false, error: 'Invalid OTP. Please try again.' };
  }

  otpDoc.verified = true;
  await otpDoc.save();

  return { valid: true, otpDoc };
}

module.exports = { generateOtpCode, createAndSendOtp, verifyOtp };
