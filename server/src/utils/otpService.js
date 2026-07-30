const crypto = require('crypto');
const Otp = require('../models/Otp');

function generateOtpCode() {
  return crypto.randomInt(100000, 999999).toString();
}

async function createAndSendOtp({ user, purpose, type = 'email', request, io }) {
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

  if (otpDoc.code !== code) {
    return { valid: false, error: 'Invalid OTP. Please try again.' };
  }

  otpDoc.verified = true;
  await otpDoc.save();

  return { valid: true, otpDoc };
}

module.exports = { generateOtpCode, createAndSendOtp, verifyOtp };
