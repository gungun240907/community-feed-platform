const mongoose = require('mongoose');

const followerSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

followerSchema.index({ follower: 1, following: 1 }, { unique: true });
followerSchema.index({ following: 1 });

followerSchema.statics.follow = async function (followerId, followingId) {
  if (followerId.toString() === followingId.toString()) {
    throw new Error('Cannot follow yourself');
  }

  const existing = await this.findOne({ follower: followerId, following: followingId });
  if (existing) {
    throw new Error('Already following this user');
  }

  const follow = await this.create({ follower: followerId, following: followingId });

  await mongoose.model('User').findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } });
  await mongoose.model('User').findByIdAndUpdate(followingId, { $inc: { followersCount: 1 } });

  return follow;
};

followerSchema.statics.unfollow = async function (followerId, followingId) {
  const result = await this.findOneAndDelete({ follower: followerId, following: followingId });
  if (!result) {
    throw new Error('Not following this user');
  }

  await mongoose.model('User').findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } });
  await mongoose.model('User').findByIdAndUpdate(followingId, { $inc: { followersCount: -1 } });

  return result;
};

module.exports = mongoose.models.Follower || mongoose.model('Follower', followerSchema);
