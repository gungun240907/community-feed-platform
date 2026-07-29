const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const User = require('../models/User');
const {
  razorpay, RAZORPAY_KEY_ID, PLANS, getPlanConfig,
  verifyPaymentSignature,
  createRazorpayOrder,
} = require('../utils/razorpay');
const { sendSubscriptionConfirmation } = require('../utils/emailService');
const crypto = require('crypto');

function generateInvoiceNumber(userId) {
  const ts = Date.now().toString(36).toUpperCase();
  const uid = userId.toString().slice(-6).toUpperCase();
  return `INV-${ts}-${uid}`;
}

async function createSubscription(req, res) {
  let plan;
  try {
    plan = req.body.plan;
    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    if (!razorpay) {
      return activateDevPlan(req, res, plan);
    }

    const order = await createRazorpayOrder(plan, req.user._id, PLANS[plan]);

    res.json({
      order_id: order.id,
      key_id: RAZORPAY_KEY_ID,
      plan,
      amount: PLANS[plan].price * 100,
      currency: 'INR',
    });
  } catch (err) {
    console.error('Create subscription error:', err);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
}

async function activateDevPlan(req, res, plan) {
  try {
    const planConfig = PLANS[plan];
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let sub = await Subscription.findOne({ user: req.user._id });
    if (sub) {
      sub.plan = plan;
      sub.status = 'active';
      sub.currentPeriodStart = now;
      sub.currentPeriodEnd = periodEnd;
      sub.cancelAtPeriodEnd = false;
      sub.activatedAt = now;
      await sub.save();
    } else {
      sub = await Subscription.create({
        user: req.user._id,
        plan,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        activatedAt: now,
      });
    }

    await User.findByIdAndUpdate(req.user._id, {
      subscriptionPlan: plan,
      badge: planConfig.badge,
      featuredProfile: !!planConfig.featuredProfile,
      postCount: 0,
      postCountResetDate: now,
    });

    await Payment.create({
      user: req.user._id,
      subscription: sub._id,
      plan,
      amount: planConfig.price,
      currency: 'inr',
      status: 'succeeded',
      invoiceNumber: generateInvoiceNumber(req.user._id),
      paidAt: now,
    });

    const user = await User.findById(req.user._id).select('-password');
    return res.json({ message: 'Subscription activated (dev mode)', subscription: sub, user });
  } catch (err) {
    console.error('Dev activate error:', err);
    res.status(500).json({ error: 'Failed to activate subscription' });
  }
}

async function verifyPayment(req, res) {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, plan } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !plan) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );
    if (!isValid) {
      return res.status(400).json({ error: 'Payment signature verification failed' });
    }

    const planConfig = PLANS[plan];
    if (!planConfig) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let sub = await Subscription.findOne({ user: req.user._id });
    if (sub) {
      sub.plan = plan;
      sub.status = 'active';
      sub.razorpayOrderId = razorpay_order_id;
      sub.currentPeriodStart = now;
      sub.currentPeriodEnd = periodEnd;
      sub.cancelAtPeriodEnd = false;
      sub.activatedAt = now;
      await sub.save();
    } else {
      sub = await Subscription.create({
        user: req.user._id,
        plan,
        status: 'active',
        razorpayOrderId: razorpay_order_id,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        activatedAt: now,
      });
    }

    await User.findByIdAndUpdate(req.user._id, {
      subscriptionPlan: plan,
      badge: planConfig.badge,
      featuredProfile: !!planConfig.featuredProfile,
      postCount: 0,
      postCountResetDate: now,
    });

    const invoiceNumber = generateInvoiceNumber(req.user._id);
    const payment = await Payment.create({
      user: req.user._id,
      subscription: sub._id,
      plan,
      amount: planConfig.price,
      currency: 'inr',
      status: 'succeeded',
      invoiceNumber,
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpaySignature: razorpay_signature,
      paidAt: now,
    });

    const user = await User.findById(req.user._id).select('-password');
    try {
      if (user) await sendSubscriptionConfirmation(user, sub, payment);
    } catch (e) {
      console.error('Email send skipped:', e.message);
    }

    res.json({ message: 'Payment verified and subscription activated', subscription: sub, user });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
}

async function getSubscriptionStatus(req, res) {
  try {
    const subscription = await Subscription.findOne({ user: req.user._id });
    const user = await User.findById(req.user._id).select('subscriptionPlan badge postCount postCountResetDate');

    res.json({
      subscription: subscription || { plan: 'free', status: 'active' },
      user: user || { subscriptionPlan: 'free', badge: null },
      plan: getPlanConfig(user?.subscriptionPlan || 'free'),
    });
  } catch (err) {
    console.error('Get subscription error:', err);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
}

async function getPaymentHistory(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      Payment.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments({ user: req.user._id }),
    ]);

    res.json({
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + payments.length < total,
      },
    });
  } catch (err) {
    console.error('Get payment history error:', err);
    res.status(500).json({ error: 'Failed to get payment history' });
  }
}

async function cancelSubscription(req, res) {
  try {
    const subscription = await Subscription.findOne({ user: req.user._id, status: 'active' });
    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    if (subscription.razorpaySubscriptionId && razorpay) {
      try {
        await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId);
      } catch (e) {
        console.error('Razorpay cancel error:', e.message);
      }
    }

    subscription.cancelAtPeriodEnd = true;
    subscription.canceledAt = new Date();
    await subscription.save();

    res.json({ message: 'Subscription canceled', subscription });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
}

async function reactivateSubscription(req, res) {
  try {
    const subscription = await Subscription.findOne({ user: req.user._id, status: 'canceled' });
    if (!subscription) {
      return res.status(404).json({ error: 'No canceled subscription found' });
    }

    if (subscription.razorpaySubscriptionId && razorpay) {
      return res.status(400).json({
        error: 'Please visit the pricing page to create a new subscription.',
        redirectToPricing: true,
      });
    }

    subscription.status = 'active';
    subscription.cancelAtPeriodEnd = false;
    subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await subscription.save();

    const planConfig = getPlanConfig(subscription.plan);
    await User.findByIdAndUpdate(req.user._id, {
      subscriptionPlan: subscription.plan,
      badge: planConfig.badge,
      featuredProfile: !!planConfig.featuredProfile,
    });

    res.json({ message: 'Subscription reactivated', subscription });
  } catch (err) {
    console.error('Reactivate subscription error:', err);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
}

async function handleRazorpayWebhook(req, res) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const crypto = require('crypto');
  const rawBody = req.body;

  const expectedSig = crypto
    .createHmac('sha256', secret || '')
    .update(rawBody)
    .digest('hex');

  const receivedSig = req.headers['x-razorpay-signature'];

  if (secret && expectedSig !== receivedSig) {
    console.error('Razorpay webhook signature verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const body = JSON.parse(rawBody.toString());

  try {
    const event = body.event;
    const payload = body.payload;

    switch (event) {
      case 'subscription.charged': {
        const subEntity = payload.subscription.entity;
        const paymentEntity = payload.payment.entity;
        const notes = subEntity.notes || {};
        const userId = notes.userId;
        const plan = notes.plan;
        const paymentId = paymentEntity.id;
        const subscriptionId = subEntity.id;

        if (!userId || !plan) break;

        const planConfig = getPlanConfig(plan);
        if (!planConfig) break;

        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        let sub = await Subscription.findOne({ user: userId });
        if (sub) {
          sub.plan = plan;
          sub.status = 'active';
          sub.razorpaySubscriptionId = subscriptionId;
          sub.currentPeriodStart = now;
          sub.currentPeriodEnd = periodEnd;
          sub.cancelAtPeriodEnd = false;
          sub.activatedAt = now;
          await sub.save();
        } else {
          sub = await Subscription.create({
            user: userId,
            plan,
            status: 'active',
            razorpaySubscriptionId: subscriptionId,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            activatedAt: now,
          });
        }

        await User.findByIdAndUpdate(userId, {
          subscriptionPlan: plan,
          badge: planConfig.badge,
          featuredProfile: !!planConfig.featuredProfile,
          postCount: 0,
          postCountResetDate: now,
        });

        const invNum = generateInvoiceNumber(userId);
        await Payment.create({
          user: userId,
          subscription: sub._id,
          plan,
          amount: planConfig.price,
          currency: 'inr',
          status: 'succeeded',
          invoiceNumber: invNum,
          razorpayPaymentId: paymentId,
          razorpaySubscriptionId: subscriptionId,
          paidAt: now,
        });

        try {
          const user = await User.findById(userId);
          if (user) await sendSubscriptionConfirmation(user, sub, { amount: planConfig.price, invoiceNumber: invNum });
        } catch (e) {
          console.error('Email send skipped:', e.message);
        }
        break;
      }

      case 'payment.captured': {
        const paymentEntity = payload.payment.entity;
        const notes = paymentEntity.notes || {};
        const userId = notes.userId;
        const plan = notes.plan;

        if (!userId || !plan) break;

        const planConfig = getPlanConfig(plan);
        if (!planConfig) break;

        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        let sub = await Subscription.findOne({ user: userId });
        if (sub) {
          sub.plan = plan;
          sub.status = 'active';
          sub.currentPeriodStart = now;
          sub.currentPeriodEnd = periodEnd;
          sub.cancelAtPeriodEnd = false;
          sub.activatedAt = now;
          if (paymentEntity.order_id) sub.razorpayOrderId = paymentEntity.order_id;
          if (paymentEntity.subscription_id) sub.razorpaySubscriptionId = paymentEntity.subscription_id;
          await sub.save();
        } else {
          const update = {
            user: userId,
            plan,
            status: 'active',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            activatedAt: now,
          };
          if (paymentEntity.order_id) update.razorpayOrderId = paymentEntity.order_id;
          if (paymentEntity.subscription_id) update.razorpaySubscriptionId = paymentEntity.subscription_id;
          sub = await Subscription.create(update);
        }

        await User.findByIdAndUpdate(userId, {
          subscriptionPlan: plan,
          badge: planConfig.badge,
          featuredProfile: !!planConfig.featuredProfile,
          postCount: 0,
          postCountResetDate: now,
        });

        const paymentData = {
          user: userId,
          subscription: sub._id,
          plan,
          amount: planConfig.price,
          currency: 'inr',
          status: 'succeeded',
          invoiceNumber: generateInvoiceNumber(userId),
          razorpayPaymentId: paymentEntity.id,
          paidAt: now,
        };
        if (paymentEntity.order_id) paymentData.razorpayOrderId = paymentEntity.order_id;
        if (paymentEntity.subscription_id) paymentData.razorpaySubscriptionId = paymentEntity.subscription_id;
        await Payment.create(paymentData);

        try {
          const user = await User.findById(userId);
          if (user) await sendSubscriptionConfirmation(user, sub, { amount: planConfig.price, invoiceNumber: paymentData.invoiceNumber });
        } catch (e) {
          console.error('Email send skipped:', e.message);
        }
        break;
      }

      case 'payment.failed': {
        const failedPayment = payload.payment.entity;
        console.error('Razorpay payment failed:', failedPayment.id, failedPayment.error_description);
        break;
      }

      case 'subscription.pending':
      case 'subscription.activated': {
        console.log(`Razorpay subscription ${event}:`, payload.subscription?.entity?.id);
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

async function devActivateSubscription(req, res) {
  try {
    const { plan } = req.body;
    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const planConfig = PLANS[plan];
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let sub = await Subscription.findOne({ user: req.user._id });
    if (sub) {
      sub.plan = plan;
      sub.status = 'active';
      sub.currentPeriodStart = now;
      sub.currentPeriodEnd = periodEnd;
      sub.cancelAtPeriodEnd = false;
      sub.activatedAt = now;
      await sub.save();
    } else {
      sub = await Subscription.create({
        user: req.user._id,
        plan,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        activatedAt: now,
      });
    }

    await User.findByIdAndUpdate(req.user._id, {
      subscriptionPlan: plan,
      badge: planConfig.badge,
      featuredProfile: !!planConfig.featuredProfile,
      postCount: 0,
      postCountResetDate: now,
    });

    const payment = await Payment.create({
      user: req.user._id,
      subscription: sub._id,
      plan,
      amount: planConfig.price,
      currency: 'inr',
      status: 'succeeded',
      invoiceNumber: generateInvoiceNumber(req.user._id),
      paidAt: now,
    });

    const user = await User.findById(req.user._id).select('-password');
    try {
      if (user) await sendSubscriptionConfirmation(user, sub, payment);
    } catch (e) {
      console.error('Email send skipped (dev mode):', e.message);
    }

    res.json({ message: 'Subscription activated (dev mode)', subscription: sub, user });
  } catch (err) {
    console.error('Dev activate error:', err);
    res.status(500).json({ error: 'Failed to activate subscription' });
  }
}

module.exports = {
  createSubscription,
  verifyPayment,
  getSubscriptionStatus,
  getPaymentHistory,
  cancelSubscription,
  reactivateSubscription,
  handleRazorpayWebhook,
  devActivateSubscription,
};
