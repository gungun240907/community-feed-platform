const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true, maxlength: 200 },
  category: { type: String, enum: ['bug', 'feature', 'account', 'other'], required: true },
  message: { type: String, required: true, maxlength: 5000 },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
}, { timestamps: true });

supportTicketSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema);
