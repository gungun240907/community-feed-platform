const mongoose = require('mongoose');

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
    mediaUrls: [
      {
        type: String, // Array of image URLs
      },
    ],
    hashtags: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    mentions: [
      {
        type: String, // Array of @mentioned usernames
        lowercase: true,
        trim: true,
      },
    ],
    postType: {
    type: String,
    enum: ['post', 'question', 'answer'],
    default: 'post',
  },
  acceptedAnswer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null,
  },
  upvoteCount: {
    type: Number,
    default: 0,
  },
  downvoteCount: {
    type: Number,
    default: 0,
  },
  likeCount: {
      type: Number,
      default: 0,
    },
    commentCount: {
      type: Number,
      default: 0,
    },
    shareCount: {
      type: Number,
      default: 0,
    },
    bookmarkCount: {
      type: Number,
      default: 0,
    },
    isReported: {
      type: Boolean,
      default: false,
    },
    reportCount: {
      type: Number,
      default: 0,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

postSchema.index({ hashtags: 1 });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ isDeleted: 1, createdAt: -1 });
postSchema.index({ updatedAt: -1 });
postSchema.index({ isReported: 1, reportCount: -1 });

module.exports = mongoose.model('Post', postSchema);
