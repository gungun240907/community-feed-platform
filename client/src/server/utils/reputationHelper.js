const ReputationLog = require('../models/ReputationLog');
const User = require('../models/User');

const REPUTATION_VALUES = {
  post_answer: 5,
  accepted_answer: 10,
  answer_5_upvotes: 5,
  question_10_upvotes: 2,
  profile_completed: 10,
  downvote_received: -2,
  downvote_reverted: 2,
  answer_deleted: -5,
  admin_removed: -10,
};

const IDEMPOTENT_REASONS = new Set([
  'accepted_answer',
  'answer_5_upvotes',
  'question_10_upvotes',
  'profile_completed',
  'admin_removed',
]);

async function addReputation(userId, reason, referenceType = null, referenceId = null) {
  const amount = REPUTATION_VALUES[reason];
  if (!amount) return;

  if (IDEMPOTENT_REASONS.has(reason) && referenceId) {
    const exists = await ReputationLog.exists({ user: userId, reason, referenceId });
    if (exists) return;
  }

  await Promise.all([
    ReputationLog.create({ user: userId, amount, reason, referenceType, referenceId }),
    User.findByIdAndUpdate(userId, { $inc: { reputation: amount } }),
  ]);
}

async function getReputationPrivileges(reputation) {
  return {
    commentWithoutRestriction: reputation >= 50,
    editCommunityPosts: reputation >= 100,
    voteToClose: reputation >= 250,
    reportContent: reputation >= 500,
    canTransfer: reputation > 50,
  };
}

async function getDailyTransferTotal(userId) {
  const ReputationTransfer = require('../models/ReputationTransfer');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const transfers = await ReputationTransfer.find({
    sender: userId,
    createdAt: { $gte: today },
  });
  return transfers.reduce((sum, t) => sum + t.amount, 0);
}

module.exports = { addReputation, getReputationPrivileges, getDailyTransferTotal, REPUTATION_VALUES };
