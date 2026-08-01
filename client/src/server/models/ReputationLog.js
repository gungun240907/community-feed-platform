const mongoose = require('mongoose');

const reputationLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true },
  reason: {
    type: String,
    enum: [
      'post_answer', 'accepted_answer', 'answer_5_upvotes', 'question_10_upvotes',
      'profile_completed', 'downvote_received', 'downvote_reverted', 'answer_deleted', 'admin_removed',
      'transfer_sent', 'transfer_received',
    ],
    required: true,
  },
  referenceType: { type: String, enum: ['post', 'comment', 'transfer'], default: null },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

reputationLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('ReputationLog', reputationLogSchema);
