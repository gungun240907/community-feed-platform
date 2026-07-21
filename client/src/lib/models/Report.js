import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      enum: ['spam', 'harassment', 'inappropriate', 'misinformation', 'plagiarism', 'other'],
    },
    description: { type: String, maxlength: [1000, 'Description cannot exceed 1,000 characters'], default: '' },
    status: { type: String, enum: ['pending', 'dismissed', 'actioned'], default: 'pending' },
    actionedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actionedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reportSchema.index({ post: 1, reporter: 1 }, { unique: true });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ status: 1, post: 1 });

export default mongoose.models.Report || mongoose.model('Report', reportSchema);
