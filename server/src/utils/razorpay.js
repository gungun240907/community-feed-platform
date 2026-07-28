let razorpay = null;
let RAZORPAY_KEY_ID = null;
try {
  RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
  if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
    const Razorpay = require('razorpay');
    razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
  }
} catch (e) {
  console.warn('Razorpay not configured. Payment features will use dev mode.');
}

const PLANS = {
  bronze: {
    name: 'Bronze',
    price: 99,
    currency: 'inr',
    interval: 'monthly',
    period: 1,
    postsPerDay: 5,
    badge: 'bronze',
    search: 'advanced',
    bookmarks: { type: 'standard', limit: 50 },
    support: 'standard',
    profileVisibility: 'standard',
    featuredProfile: false,
    exclusiveFeatures: false,
  },
  silver: {
    name: 'Silver',
    price: 299,
    currency: 'inr',
    interval: 'monthly',
    period: 1,
    postsPerDay: 15,
    badge: 'silver',
    search: 'advanced',
    bookmarks: { type: 'unlimited', limit: -1 },
    support: 'priority',
    profileVisibility: 'enhanced',
    featuredProfile: false,
    exclusiveFeatures: false,
  },
  gold: {
    name: 'Gold',
    price: 999,
    currency: 'inr',
    interval: 'monthly',
    period: 1,
    postsPerDay: -1,
    badge: 'gold',
    search: 'highest',
    bookmarks: { type: 'unlimited', limit: -1 },
    support: 'priority',
    profileVisibility: 'featured',
    featuredProfile: true,
    exclusiveFeatures: true,
  },
};

const FREE_PLAN = {
  name: 'Free',
  price: 0,
  postsPerDay: 1,
  badge: null,
  search: 'basic',
  bookmarks: { type: 'standard', limit: 50 },
  support: 'none',
  profileVisibility: 'standard',
  featuredProfile: false,
  exclusiveFeatures: false,
};

function getPlanConfig(plan) {
  if (!plan || plan === 'free') return FREE_PLAN;
  return PLANS[plan] || FREE_PLAN;
}

function verifyPaymentSignature(orderId, paymentId, signature) {
  const crypto = require('crypto');
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
}

function verifySubscriptionPaymentSignature(paymentId, subscriptionId, signature) {
  const crypto = require('crypto');
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${paymentId}|${subscriptionId}`)
    .digest('hex');
  return expected === signature;
}

async function createRazorpayOrder(plan, userId, planConfig) {
  const order = await razorpay.orders.create({
    amount: planConfig.price * 100,
    currency: 'INR',
    receipt: `sub_${userId.toString().slice(-12)}_${Date.now()}`,
    notes: {
      userId: userId.toString(),
      plan,
    },
  });
  return order;
}

module.exports = {
  razorpay,
  RAZORPAY_KEY_ID,
  PLANS,
  FREE_PLAN,
  getPlanConfig,
  verifyPaymentSignature,
  verifySubscriptionPaymentSignature,
  createRazorpayOrder,
};
