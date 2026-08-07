const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  plan: {
    type: String,
    enum: ['free', 'bronze', 'silver', 'gold'],
    default: 'free',
  },
  status: {
    type: String,
    enum: ['active', 'canceled', 'past_due', 'incomplete', 'trialing'],
    default: 'active',
  },
  razorpaySubscriptionId: {
    type: String,
    default: null,
  },
  razorpayOrderId: {
    type: String,
    default: null,
  },
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false,
  },
  activatedAt: Date,
  canceledAt: Date,
}, {
  timestamps: true,
});

subscriptionSchema.index({ razorpaySubscriptionId: 1 });
subscriptionSchema.index({ status: 1 });

module.exports = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
