const crypto = require('crypto');
const Otp = require('../models/Otp');
const { sendOtpEmail } = require('./emailService');
const { sendOtpSms } = require('./smsService');

/**
 * Production-grade OTP service.
 *
 * Design decisions (OWASP Authentication Cheat Sheet):
 *  - OTPs are generated with `crypto.randomInt` (CSPRNG), never Math.random().
 *  - Only an HMAC-SHA256 digest of the OTP is persisted (`codeHash`), keyed with
 *    a server-side pepper secret. A leaked database does not expose usable codes.
 *  - OTPs expire after OTP_EXPIRY_MINUTES (default 5 minutes).
 *  - A resend cooldown (OTP_RESEND_COOLDOWN_SECONDS, default 60s) prevents
 *    spamming a user's inbox.
 *  - Consumption is atomic (`findOneAndUpdate` with a `verified:false` guard),
 *    so each OTP can be used exactly once even under concurrent requests.
 *  - Brute-force protection: a per-OTP attempt cap (`MAX_OTP_ATTEMPTS`) locks
 *    the code after repeated failures; endpoint-level rate limiters complement
 *    this (see middleware/rateLimiter.js).
 *  - The plaintext code is never returned to callers and never sent to the
 *    browser over a socket. Delivery happens only via email/SMS.
 *  - In tests only (NODE_ENV === 'test'), the raw code is kept in an in-memory
 *    map so integration tests can assert against it without exposing it over HTTP.
 */

const VALID_PURPOSES = [
  'email_verification',
  'phone_verification',
  'password_reset',
  'login_verification',
  'language_switch',
];

const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '6', 10);
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10);
const OTP_RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10);
const MAX_OTP_ATTEMPTS = parseInt(process.env.MAX_OTP_ATTEMPTS || '5', 10);

const OTP_EXPIRY_MS = OTP_EXPIRY_MINUTES * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = OTP_RESEND_COOLDOWN_SECONDS * 1000;

const IS_TEST = process.env.NODE_ENV === 'test';

/**
 * Minimal structured error so controllers / the global error handler can map
 * it to the right HTTP response without leaking internals.
 */
function otpError(statusCode, message, { code, retryAfterMs } = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.expose = true; // safe to send `message` to the client
  if (code) err.code = code;
  if (retryAfterMs) err.retryAfterMs = retryAfterMs;
  return err;
}

/** @returns {string} Server-side pepper used to key OTP hashes. */
function getPepper() {
  if (process.env.OTP_PEPPER_SECRET) return process.env.OTP_PEPPER_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw otpError(500, 'Server misconfigured: OTP_PEPPER_SECRET is not set');
  }
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[otpService] OTP_PEPPER_SECRET not set; using dev pepper (do NOT ship to production)');
  }
  return 'dev-otp-pepper';
}

/**
 * Generate a numeric OTP using a cryptographically secure PRNG.
 * @param {number} [length]
 * @returns {string} zero-padded numeric code of the requested length
 */
function generateOtpCode(length = OTP_LENGTH) {
  if (!Number.isInteger(length) || length < 4 || length > 9) {
    throw otpError(500, 'Invalid OTP length configuration');
  }
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return String(crypto.randomInt(min, max)).padStart(length, '0');
}

/**
 * Hash an OTP so it can be stored / compared without persisting plaintext.
 * @param {string} code
 * @returns {string} hex HMAC-SHA256 digest
 */
function hashOtp(code) {
  return crypto.createHmac('sha256', getPepper()).update(code).digest('hex');
}

/** Constant-time comparison of two hex digests. */
function safeEqualHex(a, b) {
  const bufA = Buffer.from(String(a), 'hex');
  const bufB = Buffer.from(String(b), 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Test-only preview of issued OTPs. Never populated outside tests.
const testPreview = new Map();

function testKey(userId, purpose) {
  return `${String(userId)}:${purpose}`;
}

function storeTestPreview(userId, purpose, code, expiresAt) {
  if (IS_TEST) {
    testPreview.set(testKey(userId, purpose), { code, expiresAt });
  }
}

/**
 * Test helper: returns the last issued plaintext OTP for a (user, purpose).
 * Only available when NODE_ENV === 'test'. Returns null otherwise.
 */
function getTestOtpPreview(userId, purpose) {
  if (!IS_TEST) return null;
  const entry = testPreview.get(testKey(userId, purpose));
  if (!entry) return null;
  if (new Date(entry.expiresAt).getTime() < Date.now()) return null;
  return { code: entry.code, expiresAt: entry.expiresAt };
}

/**
 * Look up the most recent active (unverified, unexpired) OTP for a user+purpose.
 */
async function findActiveOtp(userId, purpose) {
  return Otp.findOne({
    user: userId,
    purpose,
    verified: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
}

/**
 * Compute remaining resend cooldown for the most recent OTP.
 * @returns {{ active: boolean, retryAfterMs: number, expiresInMs: number }}
 */
async function getOtpStatus({ userId, purpose }) {
  const latest = await Otp.findOne({ user: userId, purpose }).sort({ createdAt: -1 });
  if (!latest) return { active: false, retryAfterMs: 0, expiresInMs: 0 };

  const now = Date.now();
  const cooldownUntil = new Date(latest.createdAt).getTime() + OTP_RESEND_COOLDOWN_MS;
  const expiresAt = new Date(latest.expiresAt).getTime();
  const active = !latest.verified && expiresAt > now;

  return {
    active,
    retryAfterMs: Math.max(0, cooldownUntil - now),
    expiresInMs: Math.max(0, expiresAt - now),
  };
}

/**
 * Generate, persist (hashed) and deliver an OTP for a user.
 *
 * @param {object} opts
 * @param {object} opts.user          Mongoose User document
 * @param {string} opts.purpose       Allowed purpose (see VALID_PURPOSES)
 * @param {'email'|'phone'} [opts.type]
 * @param {string} [opts.ip]          Requesting IP (for audit)
 * @param {boolean} [opts.deliver=true]
 * @returns {Promise<{expiresAt: Date, purpose: string, type: string, retryAfterMs: number}>}
 */
async function createAndSendOtp({ user, purpose, type = 'email', ip = '', deliver = true }) {
  if (!VALID_PURPOSES.includes(purpose)) {
    throw otpError(400, 'Invalid OTP purpose', { code: 'INVALID_PURPOSE' });
  }
  if (type !== 'email' && type !== 'phone') {
    throw otpError(400, 'Invalid OTP type', { code: 'INVALID_TYPE' });
  }

  // Resend cooldown: refuse to re-issue while the previous OTP is still "hot".
  const latest = await findActiveOtp(user._id, purpose);
  if (latest) {
    const cooldownRemaining = OTP_RESEND_COOLDOWN_MS - (Date.now() - new Date(latest.createdAt).getTime());
    if (cooldownRemaining > 0) {
      throw otpError(429, 'Please wait before requesting another OTP.', {
        code: 'RESEND_COOLDOWN',
        retryAfterMs: cooldownRemaining,
      });
    }
    // Cooldown elapsed -> invalidate the previous code so only the newest is usable.
    await Otp.deleteMany({ user: user._id, purpose, verified: false });
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  const otpDoc = await Otp.create({
    user: user._id,
    codeHash: hashOtp(code),
    type,
    purpose,
    ip,
    expiresAt,
    resendCount: latest ? latest.resendCount + 1 : 0,
  });

  if (deliver) {
    let delivered = false;
    try {
      delivered = type === 'phone'
        ? await sendOtpSms(user, code, purpose)
        : await sendOtpEmail({ user, otp: code, purpose });
    } catch (err) {
      console.error('[otpService] Delivery threw:', err.message);
      delivered = false;
    }

    if (!delivered) {
      // Do not leave an undeliverable OTP behind; the user must try again.
      await Otp.deleteMany({ _id: otpDoc._id });
      throw otpError(503, 'Unable to deliver the OTP. Please try again later.', {
        code: 'DELIVERY_FAILED',
      });
    }
  }

  storeTestPreview(user._id, purpose, code, expiresAt);

  return {
    expiresAt,
    purpose,
    type,
    retryAfterMs: 0,
  };
}

/**
 * Verify a submitted OTP and consume it atomically (one-time use).
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.purpose
 * @param {string} opts.code
 * @returns {Promise<{valid: boolean, error?: string, code?: string, remaining?: number, otpDoc?: object}>}
 */
async function verifyOtp({ userId, purpose, code }) {
  if (!code || typeof code !== 'string' || !new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) {
    return { valid: false, code: 'INVALID_FORMAT', error: 'Invalid OTP format.' };
  }

  const otpDoc = await findActiveOtp(userId, purpose);
  if (!otpDoc) {
    return {
      valid: false,
      code: 'NO_ACTIVE_OTP',
      error: 'OTP not found or expired. Please request a new one.',
    };
  }

  // Hard lockout: the code is already exhausted by failed guesses.
  if (otpDoc.attempts >= MAX_OTP_ATTEMPTS) {
    await Otp.updateOne({ _id: otpDoc._id, verified: false }, {
      $set: { verified: true, consumedAt: new Date() },
    });
    return {
      valid: false,
      code: 'LOCKED',
      error: 'Too many incorrect attempts. Please request a new OTP.',
    };
  }

  const submittedHash = hashOtp(code.trim());

  if (!safeEqualHex(otpDoc.codeHash, submittedHash)) {
    // Atomically increment the attempt counter and lock once the cap is reached.
    const updated = await Otp.findOneAndUpdate(
      { _id: otpDoc._id, verified: false },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    const currentAttempts = updated ? updated.attempts : otpDoc.attempts + 1;

    if (currentAttempts >= MAX_OTP_ATTEMPTS) {
      await Otp.updateOne({ _id: otpDoc._id, verified: false }, {
        $set: { verified: true, consumedAt: new Date() },
      });
      return {
        valid: false,
        code: 'LOCKED',
        error: 'Too many incorrect attempts. Please request a new OTP.',
      };
    }

    const remaining = MAX_OTP_ATTEMPTS - currentAttempts;
    return {
      valid: false,
      code: 'MISMATCH',
      remaining,
      error: `Invalid OTP. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`,
    };
  }

  // Atomic one-time consumption. The `verified: false` guard means a concurrent
  // request that already consumed this OTP cannot consume it twice.
  const consumed = await Otp.findOneAndUpdate(
    { _id: otpDoc._id, verified: false, attempts: { $lt: MAX_OTP_ATTEMPTS } },
    { $set: { verified: true, consumedAt: new Date() } },
    { new: true }
  );

  if (!consumed) {
    return {
      valid: false,
      code: 'ALREADY_USED',
      error: 'This OTP has already been used. Please request a new one.',
    };
  }

  return { valid: true, otpDoc: consumed };
}

module.exports = {
  VALID_PURPOSES,
  MAX_OTP_ATTEMPTS,
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
  generateOtpCode,
  hashOtp,
  createAndSendOtp,
  verifyOtp,
  getOtpStatus,
  getTestOtpPreview,
};
