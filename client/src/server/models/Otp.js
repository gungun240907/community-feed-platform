const mongoose = require('mongoose');

/**
 * One-Time Password (OTP) document.
 *
 * Security notes:
 *  - Only a hash of the OTP is stored (`codeHash`), never the plaintext value.
 *    The hash is an HMAC-SHA256 of the code keyed with a server-side pepper
 *    (OTP_PEPPER_SECRET). A database leak therefore does not reveal usable OTPs.
 *  - `expiresAt` is indexed with a TTL so expired documents are cleaned up by
 *    MongoDB automatically.
 *  - `verified` + atomic consumption in the service guarantees one-time use.
 *  - `attempts` caps brute-force guesses against a single issued OTP.
 *  - `ip` records where the OTP was requested for auditing / abuse analysis.
 */
const otpSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // HMAC-SHA256 digest of the OTP code (peppered). NEVER store plaintext.
    codeHash: { type: String, required: true },
    // Provider-managed OTP (e.g. Message Central): when set, verification is
    // delegated to the provider via its verificationId instead of our local hash.
    provider: { type: String, default: null }, // e.g. 'messagecentral'
    providerVerificationId: { type: String, default: null },
    providerChannel: { type: String, default: null }, // 'sms' | 'whatsapp'
    type: { type: String, enum: ['email', 'phone'], required: true },
    // For `language_switch` OTPs, the exact language the OTP was issued for.
    // Verification must match this so a French (email) OTP cannot be used to
    // switch to a phone-verified language and vice-versa.
    language: { type: String, default: null },
    purpose: {
      type: String,
      enum: [
        'language_switch',
        'login_verification',
        'email_verification',
        'phone_verification',
        'password_reset',
      ],
      required: true,
    },
    ip: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    consumedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    // Total number of times this purpose was re-issued to the same user.
    resendCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Fast lookup of the most recent unverified OTP for a (user, purpose).
otpSchema.index({ user: 1, purpose: 1, createdAt: -1 });
// Clean up expired documents automatically (TTL).
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Efficient "is there an active OTP?" query for cooldown checks.
otpSchema.index({ user: 1, purpose: 1, verified: 1, expiresAt: 1 });

module.exports = mongoose.models.Otp || mongoose.model('Otp', otpSchema);
