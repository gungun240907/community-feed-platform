const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    default: null,
  },
  plan: {
    type: String,
    enum: ['bronze', 'silver', 'gold'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'inr',
  },
  status: {
    type: String,
    enum: ['succeeded', 'pending', 'failed', 'refunded'],
    default: 'pending',
  },
  razorpayPaymentId: {
    type: String,
    default: null,
  },
  razorpayOrderId: {
    type: String,
    default: null,
  },
  razorpaySubscriptionId: {
    type: String,
    default: null,
  },
  razorpaySignature: {
    type: String,
    default: null,
  },
  paidAt: Date,
}, {
  timestamps: true,
});

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ razorpayPaymentId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
