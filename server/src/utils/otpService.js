const crypto = require('crypto');
const Otp = require('../models/Otp');
const { sendOtpEmail } = require('./emailService');
const { sendOtpSms } = require('./smsService');

const MAX_OTP_ATTEMPTS = 5;

function generateOtpCode() {
  return crypto.randomInt(100000, 999999).toString();
}

async function createAndSendOtp({ user, purpose, type = 'email', request, io, deliver = true }) {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await Otp.deleteMany({ user: user._id, purpose, verified: false });
  await Otp.create({
    user: user._id,
    code,
    type,
    purpose,
    expiresAt,
  });

  let delivered = false;
  if (deliver) {
    if (type === 'phone') {
      delivered = await sendOtpSms(user, code, purpose);
    } else {
      delivered = await sendOtpEmail({ user, otp: code, purpose });
    }

    if (!delivered) {
      throw Object.assign(new Error(
        type === 'phone'
          ? 'SMS service is not configured. Please try again later.'
          : 'Email service is not configured. Please try again later.'
      ), { statusCode: 503 });
    }
  }

  if (io) {
    const userId = user._id.toString();
    io.to(userId).emit('otp', {
      purpose,
      code,
      expiresAt: expiresAt.toISOString(),
      type,
    });
    console.log(`[Real-time OTP] Emitted to user ${userId} for ${purpose}: ${code}`);
  }

  return code;
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

  if (otpDoc.attempts >= MAX_OTP_ATTEMPTS) {
    otpDoc.verified = true;
    await otpDoc.save();
    return { valid: false, error: 'Too many incorrect attempts. Please request a new OTP.' };
  }

  if (otpDoc.code !== code) {
    otpDoc.attempts += 1;
    await otpDoc.save();
    const remaining = MAX_OTP_ATTEMPTS - otpDoc.attempts;
    return {
      valid: false,
      error: remaining > 0
        ? `Invalid OTP. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`
        : 'Too many incorrect attempts. Please request a new OTP.',
    };
  }

  otpDoc.verified = true;
  await otpDoc.save();

  return { valid: true, otpDoc };
}

module.exports = { generateOtpCode, createAndSendOtp, verifyOtp, MAX_OTP_ATTEMPTS };
