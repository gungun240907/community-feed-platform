const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    type: {
      type: String,
      enum: ['like', 'bookmark', 'upvote', 'downvote', 'close_vote'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

likeSchema.index({ user: 1, post: 1, type: 1 }, { unique: true });
likeSchema.index({ post: 1, type: 1 });

module.exports = mongoose.models.Like || mongoose.model('Like', likeSchema);
