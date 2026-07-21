import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Post content is required'],
      maxlength: [10000, 'Post cannot exceed 10,000 characters'],
    },
    mediaUrls: [{ type: String }],
    hashtags: [{ type: String, lowercase: true, trim: true }],
    mentions: [{ type: String, lowercase: true, trim: true }],
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    bookmarkCount: { type: Number, default: 0 },
    isReported: { type: Boolean, default: false },
    reportCount: { type: Number, default: 0 },
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

postSchema.index({ hashtags: 1 });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ isDeleted: 1, createdAt: -1 });
postSchema.index({ isReported: 1, reportCount: -1 });

export default mongoose.models.Post || mongoose.model('Post', postSchema);
