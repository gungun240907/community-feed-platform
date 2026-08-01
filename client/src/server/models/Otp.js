const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  code: { type: String, required: true },
  type: { type: String, enum: ['email', 'phone'], required: true },
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
  expiresAt: { type: Date, required: true },
  verified: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
}, { timestamps: true });

otpSchema.index({ user: 1, purpose: 1, createdAt: -1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', otpSchema);
