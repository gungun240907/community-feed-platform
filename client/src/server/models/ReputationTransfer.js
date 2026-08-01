const mongoose = require('mongoose');

const reputationTransferSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 1, max: 50 },
  reason: { type: String, required: true, maxlength: 200 },
}, { timestamps: true });

reputationTransferSchema.index({ sender: 1, createdAt: -1 });
reputationTransferSchema.index({ receiver: 1, createdAt: -1 });

module.exports = mongoose.model('ReputationTransfer', reputationTransferSchema);
