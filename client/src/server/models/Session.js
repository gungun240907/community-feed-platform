const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
  },
  browser: {
    type: String,
    default: 'Unknown',
  },
  os: {
    type: String,
    default: 'Unknown',
  },
  deviceType: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    default: 'unknown',
  },
  deviceFingerprint: {
    type: String,
    default: '',
  },
  ip: {
    type: String,
    default: '',
  },
  location: {
    city: { type: String, default: '' },
    country: { type: String, default: '' },
    raw: { type: String, default: '' },
  },
  lastActiveAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  isTrusted: {
    type: Boolean,
    default: false,
  },
  isRevoked: {
    type: Boolean,
    default: false,
  },
  loginMethod: {
    type: String,
    enum: ['password', 'otp', 'trusted_device'],
    default: 'password',
  },
}, {
  timestamps: true,
});

sessionSchema.index({ user: 1, isRevoked: 1, expiresAt: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.Session || mongoose.model('Session', sessionSchema);
