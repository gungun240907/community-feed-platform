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
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  const uid = userId.toString().slice(-6).toUpperCase();
  return `INV-${ts}-${rand}-${uid}`;
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

async function createSubscription(req, res) {
  let plan;
  try {
    plan = req.body.plan;
    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    if (!razorpay) {
      if (isProduction()) {
        return res.status(503).json({ error: 'Payment service is not configured' });
      }
      return activateDevPlan(req, res, plan);
    }

    const order = await createRazorpayOrder(plan, req.user._id, PLANS[plan]);

    await Payment.create({
      user: req.user._id,
      plan,
      amount: PLANS[plan].price,
      currency: 'inr',
      status: 'pending',
      razorpayOrderId: order.id,
    });

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
    payment.invoiceUrl = `${req.protocol}://${req.get('host')}/api/subscriptions/payments/${payment._id}/invoice`;
    await payment.save();

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

    const pendingPayment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
      status: 'pending',
    });

    if (!pendingPayment) {
      return res.status(400).json({ error: 'No pending order found. Create a subscription first.' });
    }

    if (pendingPayment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'This order does not belong to your account' });
    }

    if (pendingPayment.plan !== plan) {
      return res.status(400).json({ error: 'Plan does not match the order' });
    }

    const duplicate = await Payment.findOne({ razorpayPaymentId: razorpay_payment_id });
    if (duplicate) {
      return res.status(409).json({ error: 'This payment has already been processed' });
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
    const base = `${req.protocol}://${req.get('host')}`;
    const invoiceUrl = `${base}/api/subscriptions/payments/${pendingPayment._id}/invoice`;

    pendingPayment.plan = plan;
    pendingPayment.subscription = sub._id;
    pendingPayment.amount = planConfig.price;
    pendingPayment.status = 'succeeded';
    pendingPayment.invoiceNumber = invoiceNumber;
    pendingPayment.invoiceUrl = invoiceUrl;
    pendingPayment.razorpayPaymentId = razorpay_payment_id;
    pendingPayment.razorpaySignature = razorpay_signature;
    pendingPayment.paidAt = now;
    await pendingPayment.save();
    const payment = pendingPayment;

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

  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not set. Rejecting webhook.');
    return res.status(503).json({ error: 'Webhook not configured' });
  }

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const receivedSig = req.headers['x-razorpay-signature'];

  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  const receivedBuf = Buffer.from(receivedSig || '', 'utf8');
  if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
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
        const newPayment = await Payment.create({
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
        const invUrl = `${req.protocol}://${req.get('host')}/api/subscriptions/payments/${newPayment._id}/invoice`;

        try {
          const user = await User.findById(userId);
          if (user) await sendSubscriptionConfirmation(user, sub, { amount: planConfig.price, invoiceNumber: invNum, invoiceUrl: invUrl });
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
        const capturedPayment = await Payment.create(paymentData);
        const capturedInvUrl = `${req.protocol}://${req.get('host')}/api/subscriptions/payments/${capturedPayment._id}/invoice`;

        try {
          const user = await User.findById(userId);
          if (user) await sendSubscriptionConfirmation(user, sub, { amount: planConfig.price, invoiceNumber: paymentData.invoiceNumber, invoiceUrl: capturedInvUrl });
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
    if (isProduction() || process.env.ALLOW_DEV_ACTIVATE !== 'true') {
      return res.status(404).json({ error: 'Not found' });
    }

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
    payment.invoiceUrl = `${req.protocol}://${req.get('host')}/api/subscriptions/payments/${payment._id}/invoice`;
    await payment.save();

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

async function downloadInvoice(req, res) {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, user: req.user._id });
    if (!payment) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const user = await User.findById(payment.user).select('username displayName email');
    const planLabel = payment.plan.charAt(0).toUpperCase() + payment.plan.slice(1);
    const amount = `₹${payment.amount}.00`;
    const paidDate = payment.paidAt ? new Date(payment.paidAt).toLocaleString() : 'N/A';
    const invoiceNumber = payment.invoiceNumber || payment._id.toString();
    const customerName = user?.displayName || user?.username || 'Customer';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1f2937; margin: 0; padding: 32px; }
    .invoice { max-width: 720px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #6366f1, #a855f7); padding: 32px; color: #fff; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header .inv { font-size: 14px; opacity: .9; }
    .body { padding: 32px; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .row .label { color: #6b7280; }
    .row .value { font-weight: 600; }
    .total { display: flex; justify-content: space-between; padding: 16px 0; font-size: 18px; font-weight: 700; }
    .footer { padding: 24px 32px; background: #f9fafb; font-size: 12px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div><h1>DevFeed</h1><div class="inv">Community Platform</div></div>
      <div style="text-align:right;"><div>Invoice</div><div style="font-size:18px;font-weight:700;">${invoiceNumber}</div></div>
    </div>
    <div class="body">
      <div class="row"><span class="label">Billed To</span><span class="value">${customerName}</span></div>
      <div class="row"><span class="label">Email</span><span class="value">${user?.email || 'N/A'}</span></div>
      <div class="row"><span class="label">Plan</span><span class="value">${planLabel} (Monthly)</span></div>
      <div class="row"><span class="label">Payment Date</span><span class="value">${paidDate}</span></div>
      <div class="row"><span class="label">Status</span><span class="value">Paid</span></div>
      <div class="row"><span class="label">Payment ID</span><span class="value">${payment.razorpayPaymentId || 'N/A'}</span></div>
      <div class="total"><span>Total (${payment.currency.toUpperCase()})</span><span>${amount}</span></div>
    </div>
    <div class="footer">DevFeed Community Platform &mdash; Thank you for your subscription.</div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceNumber}.html"`);
    res.send(html);
  } catch (err) {
    console.error('Download invoice error:', err);
    res.status(500).json({ error: 'Failed to generate invoice' });
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
  downloadInvoice,
};
