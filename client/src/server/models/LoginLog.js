const mongoose = require('mongoose');

const loginLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
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
  ip: {
    type: String,
    default: '',
  },
  location: {
    city: { type: String, default: '' },
    country: { type: String, default: '' },
    raw: { type: String, default: '' },
  },
  method: {
    type: String,
    enum: ['password', 'otp', 'trusted_device', 'firebase_phone'],
    default: 'password',
  },
  success: {
    type: Boolean,
    default: true,
  },
  failureReason: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

loginLogSchema.index({ user: 1, createdAt: -1 });
loginLogSchema.index({ createdAt: -1 });

module.exports = mongoose.models.LoginLog || mongoose.model('LoginLog', loginLogSchema);
