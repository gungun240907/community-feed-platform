const Subscription = require('../models/Subscription');
const { getPlanConfig } = require('../utils/razorpay');

async function getSubscriptionWithPlan(userId) {
  const sub = await Subscription.findOne({ user: userId, status: 'active' });
  if (sub) {
    return { subscription: sub, plan: getPlanConfig(sub.plan) };
  }
  return { subscription: null, plan: getPlanConfig('free') };
}

async function checkPostLimit(req, res, next) {
  try {
    const { plan } = await getSubscriptionWithPlan(req.user._id);
    if (plan.postsPerDay === -1) {
      return next();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const postCount = req.user.postCount || 0;
    const resetDate = req.user.postCountResetDate;

    let currentCount = postCount;
    if (!resetDate || resetDate < today) {
      currentCount = 0;
      req.user.postCount = 0;
      req.user.postCountResetDate = today;
      await req.user.save();
    }

    if (currentCount >= plan.postsPerDay) {
      return res.status(429).json({
        error: `Daily post limit reached. ${plan.name} plan allows ${plan.postsPerDay} post${plan.postsPerDay > 1 ? 's' : ''} per day. Upgrade to post more.`,
        limit: plan.postsPerDay,
        current: currentCount,
        plan: plan.name.toLowerCase(),
      });
    }

    req.postLimitInfo = { current: currentCount, limit: plan.postsPerDay, plan: plan.name.toLowerCase() };
    next();
  } catch (err) {
    console.error('Post limit check error:', err);
    next();
  }
}

async function checkSearchAccess(req, res, next) {
  try {
    const { plan } = await getSubscriptionWithPlan(req.user?._id);
    req.searchPlan = plan;
    next();
  } catch (err) {
    req.searchPlan = getPlanConfig('free');
    next();
  }
}

async function checkBookmarkLimit(req, res, next) {
  try {
    const { plan } = await getSubscriptionWithPlan(req.user._id);
    const bookmarkLimit = plan.bookmarks?.limit ?? 50;

    if (bookmarkLimit === -1) return next();

    const Like = require('../models/Like');
    const count = await Like.countDocuments({ user: req.user._id, type: 'bookmark' });

    if (count >= bookmarkLimit) {
      return res.status(429).json({
        error: `Bookmark limit reached. Your plan allows up to ${bookmarkLimit} bookmarks. Upgrade to Silver or Gold for unlimited bookmarks.`,
        limit: bookmarkLimit,
        current: count,
      });
    }

    next();
  } catch (err) {
    console.error('Bookmark limit check error:', err);
    next();
  }
}

async function rateLimitSupport(req, res, next) {
  try {
    const plan = req.user?.subscriptionPlan || 'free';
    const maxPerDay = plan === 'free' ? 3 : 10;

    const SupportTicket = require('../models/SupportTicket');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await SupportTicket.countDocuments({
      user: req.user._id,
      createdAt: { $gte: today },
    });

    if (count >= maxPerDay) {
      return res.status(429).json({
        error: `Support ticket limit reached. ${plan === 'free' ? 'Free' : 'Your'} plan allows ${maxPerDay} ticket${maxPerDay > 1 ? 's' : ''} per day.`,
        limit: maxPerDay,
        current: count,
      });
    }

    next();
  } catch (err) {
    console.error('Support rate limit error:', err);
    next();
  }
}

module.exports = { getSubscriptionWithPlan, checkPostLimit, checkSearchAccess, checkBookmarkLimit, rateLimitSupport };