const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const { boot, api, UA_A, UA_B } = require('./helpers');
const otpService = require('../src/server/utils/otpService');

const ctx = {};

const SEED = [
  ['alice', 'alice@test.com', 'Alice123!', 10],
  ['charlie', 'charlie@test.com', 'Charlie123!', 120],
  ['bob', 'bob@test.com', 'Bob123!', 300],
  ['guru', 'guru@test.com', 'Guru123!', 600],
  ['dave', 'dave@test.com', 'Dave123!', 10],
  ['erin', 'erin@test.com', 'Erin123!', 10],
  ['newbie', 'newbie@test.com', 'Newbie123!', 10],
  ['resetuser', 'reset@test.com', 'Reset123!', 10],
  ['qliker1', 'ql1@test.com', 'Ql1k3r123!', 10],
  ['qliker2', 'ql2@test.com', 'Ql2k3r123!', 10],
  ['qliker3', 'ql3@test.com', 'Ql3k3r123!', 10],
  ['fliker', 'flk@test.com', 'Fl1k3r123!', 10],
  ['admin', 'admin@devfeed.com', 'Admin123!', 0],
];
const PASS = Object.fromEntries(SEED.map(([u, , p]) => [u, p]));

function post(token, content, postType = 'post') {
  return api(ctx.base, 'POST', '/api/posts', { token, body: { content, postType } });
}

async function repOf(username) {
  const User = ctx.mongoose.model('User');
  const u = await User.findOne({ username }).select('reputation');
  return u.reputation;
}

async function latestOtp(userId, purpose) {
  const Otp = ctx.mongoose.model('Otp');
  return Otp.findOne({ user: userId, purpose, verified: false }).sort({ createdAt: -1 });
}

async function seedPendingPayment(userId, plan, orderId) {
  const Payment = ctx.mongoose.model('Payment');
  await Payment.create({ user: userId, plan, amount: 99, currency: 'inr', status: 'pending', razorpayOrderId: orderId });
}

function hmac(orderId, paymentId) {
  return crypto.createHmac('sha256', 'test-signing-secret').update(`${orderId}|${paymentId}`).digest('hex');
}

before(async () => {
  const h = await boot();
  Object.assign(ctx, h);
  ctx.tokens = {};
  ctx.users = {};

  const User = ctx.mongoose.model('User');
  for (const [username, email, password, rep] of SEED) {
    const u = await User.create({
      username,
      email,
      password,
      displayName: username,
      reputation: rep,
      role: username === 'admin' ? 'admin' : 'user',
    });
    ctx.users[username] = { _id: u._id.toString() };
  }

  const Subscription = ctx.mongoose.model('Subscription');
  for (const [username] of SEED) {
    if (username === 'newbie') continue;
    await Subscription.create({ user: ctx.users[username]._id, plan: 'gold', status: 'active' });
  }

  for (const [username] of SEED) {
    const r = await api(ctx.base, 'POST', '/api/auth/login', { body: { login: username, password: PASS[username] } });
    assert.strictEqual(r.status, 200, `login failed for ${username}: ${r.data?.error || r.status}`);
    ctx.tokens[username] = r.data.token;
  }

  const feedPosts = [
    ['alice', 'Introduction to #nodejs streams'],
    ['alice', 'Async patterns in #nodejs explained'],
    ['alice', 'Learning #python basics for beginners'],
    ['alice', 'Why #python for data science'],
    ['alice', 'Node.js event loop #nodejs deep dive'],
    ['alice', 'Python generators #python'],
    ['bob', '#nodejs performance tips'],
    ['bob', '#python type hints guide'],
    ['bob', 'Streaming with #nodejs'],
    ['charlie', 'React frontend with a #nodejs backend'],
    ['charlie', 'Deploying #python microservices'],
    ['charlie', 'Testing with #nodejs jest'],
  ];
  for (const [author, content] of feedPosts) {
    const r = await post(ctx.tokens[author], content);
    assert.strictEqual(r.status, 201, `feed seed post failed for ${author}`);
  }
});

after(async () => {
  console.log('\n[suite] Ethereal inbox: ' + ctx.ethereal.url + '  login: ' + ctx.ethereal.user + ' / ' + ctx.ethereal.pass);
  if (ctx.close) await ctx.close();
});

// ---------------------------------------------------------------------------
// AUTH & SESSIONS
// ---------------------------------------------------------------------------

test('register creates a user and returns a token', async () => {
  const r = await api(ctx.base, 'POST', '/api/auth/register', {
    body: { username: 'freshuser', email: 'fresh@test.com', password: 'Fresh123!', displayName: 'Fresh', phone: '+15550009999' },
  });
  assert.strictEqual(r.status, 201);
  assert.ok(r.data.token);
  ctx.tokens.freshuser = r.data.token;
  ctx.users.freshuser = { _id: r.data.user._id };

  const dup = await api(ctx.base, 'POST', '/api/auth/register', {
    body: { username: 'freshuser', email: 'fresh@test.com', password: 'Fresh123!', phone: '+15550009999' },
  });
  assert.strictEqual(dup.status, 409);

  const missing = await api(ctx.base, 'POST', '/api/auth/register', { body: { username: 'x', email: 'x@test.com' } });
  assert.strictEqual(missing.status, 400);
});

test('register validates its payload and returns 400 (never a 500) for invalid input', async () => {
  const r = await api(ctx.base, 'POST', '/api/auth/register', {
    body: { username: 'ab', email: 'bad', password: 'x' },
  });
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.data.code, 'VALIDATION_ERROR');
  assert.ok(r.data.fields, 'field-level errors must be returned');
  assert.ok(r.data.fields.username);
  assert.ok(r.data.fields.email);
  assert.ok(r.data.fields.password);
});

test('login rejects invalid credentials', async () => {
  const r = await api(ctx.base, 'POST', '/api/auth/login', { body: { login: 'alice', password: 'wrongpass' } });
  assert.strictEqual(r.status, 401);
});

test('GET /auth/me returns the user without password', async () => {
  const r = await api(ctx.base, 'GET', '/api/auth/me', { token: ctx.tokens.alice });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.user.username, 'alice');
  assert.strictEqual(r.data.user.password, undefined);
});

test('login-logs are recorded for successful logins', async () => {
  const r = await api(ctx.base, 'GET', '/api/login-logs', { token: ctx.tokens.alice });
  assert.strictEqual(r.status, 200);
  assert.ok(r.data.logs.length >= 1);
  assert.strictEqual(r.data.logs[0].success, true);
});

test('login issues a session directly (no OTP), then session management works', async () => {
  // freshuser was registered on UA_A (trusted session). Log in from a different
  // device (UA_B) — login no longer requires an OTP; it returns a token directly.
  const loginR = await api(ctx.base, 'POST', '/api/auth/login', {
    body: { login: 'fresh@test.com', password: 'Fresh123!' },
    ua: UA_B,
  });
  assert.strictEqual(loginR.status, 200);
  assert.strictEqual(loginR.data.requiresOtp, undefined, 'login must not require OTP');
  assert.ok(loginR.data.token, 'login must return a session token');
  ctx.tokens.fresh2 = loginR.data.token;

  // Sessions: should include the trusted Chrome session + this Firefox session
  const sessions = await api(ctx.base, 'GET', '/api/sessions', { token: ctx.tokens.fresh2 });
  assert.strictEqual(sessions.status, 200);
  assert.ok(sessions.data.sessions.length >= 2);
  const chrome = sessions.data.sessions.find((s) => s.browser === 'Chrome');
  assert.ok(chrome, 'expected a Chrome session from registration');

  // Revoke the old Chrome session; its token must stop working.
  // The sessions list does not expose sessionId, so decode it from the register JWT.
  const jwt = require('jsonwebtoken');
  const decoded = jwt.decode(ctx.tokens.freshuser);
  const chromeSessionId = decoded.sessionId;
  assert.ok(chromeSessionId, 'expected a sessionId in the register JWT');

  const revoke = await api(ctx.base, 'POST', `/api/sessions/revoke/${chromeSessionId}`, { token: ctx.tokens.fresh2 });
  assert.strictEqual(revoke.status, 200);
  const oldToken = await api(ctx.base, 'GET', '/api/auth/me', { token: ctx.tokens.freshuser });
  assert.strictEqual(oldToken.status, 401);

  // Logout revokes the current session
  const logout = await api(ctx.base, 'POST', '/api/sessions/logout', { token: ctx.tokens.fresh2 });
  assert.strictEqual(logout.status, 200);
  const afterLogout = await api(ctx.base, 'GET', '/api/auth/me', { token: ctx.tokens.fresh2 });
  assert.strictEqual(afterLogout.status, 401);
});

// ---------------------------------------------------------------------------
// FORGOT PASSWORD
// ---------------------------------------------------------------------------

test('forgot-password delivers via email and never returns the password', async () => {
  const User = ctx.mongoose.model('User');
  const beforeDoc = await User.findOne({ email: 'reset@test.com' }).select('+password');
  const beforeHash = beforeDoc.password;

  const r = await api(ctx.base, 'POST', '/api/auth/forgot-password', { body: { email: 'reset@test.com' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.password, undefined);
  assert.strictEqual(r.data.newPassword, undefined);
  assert.strictEqual(typeof r.data.message, 'string', 'response should just contain a delivery message');

  const afterDoc = await User.findOne({ email: 'reset@test.com' }).select('+password');
  assert.notStrictEqual(afterDoc.password, beforeHash, 'password must actually change');
  assert.strictEqual(await afterDoc.comparePassword('Reset123!'), false, 'old password must no longer work');

  const oldLogin = await api(ctx.base, 'POST', '/api/auth/login', { body: { login: 'reset@test.com', password: 'Reset123!' } });
  assert.strictEqual(oldLogin.status, 401);
});

test('forgot-password is limited to once per day', async () => {
  const r = await api(ctx.base, 'POST', '/api/auth/forgot-password', { body: { email: 'reset@test.com' } });
  assert.strictEqual(r.status, 429);
});

test('forgot-password unknown account and missing fields', async () => {
  const unknown = await api(ctx.base, 'POST', '/api/auth/forgot-password', { body: { email: 'nobody@test.com' } });
  assert.strictEqual(unknown.status, 200, 'must not reveal whether an account exists (anti-enumeration)');

  const missing = await api(ctx.base, 'POST', '/api/auth/forgot-password', { body: {} });
  assert.strictEqual(missing.status, 400);
});

// ---------------------------------------------------------------------------
// SUBSCRIPTION / PREMIUM
// ---------------------------------------------------------------------------

test('dev-activate works locally (NODE_ENV=development + ALLOW_DEV_ACTIVATE=true)', async () => {
  const r = await api(ctx.base, 'POST', '/api/subscriptions/dev-activate', {
    token: ctx.tokens.alice,
    body: { plan: 'gold' },
  });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.user.subscriptionPlan, 'gold');
  assert.strictEqual(r.data.user.badge, 'gold');
  assert.strictEqual(r.data.subscription.status, 'active');
});

test('create-subscription in dev mode activates and records a succeeded payment with invoice', async () => {
  const r = await api(ctx.base, 'POST', '/api/subscriptions/create-subscription', {
    token: ctx.tokens.guru,
    body: { plan: 'silver' },
  });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.subscription.status, 'active');
  assert.strictEqual(r.data.user.subscriptionPlan, 'silver');

  const history = await api(ctx.base, 'GET', '/api/subscriptions/payments', { token: ctx.tokens.guru });
  assert.strictEqual(history.status, 200);
  const latest = history.data.payments[0];
  assert.strictEqual(latest.plan, 'silver');
  assert.strictEqual(latest.status, 'succeeded');
  assert.ok(latest.invoiceNumber, 'payment should have an invoice number');
  assert.ok(latest.invoiceUrl, 'payment should have an invoice URL');
  ctx.invoicePath = new URL(latest.invoiceUrl).pathname + new URL(latest.invoiceUrl).search;
});

test('invoice downloads as HTML', async () => {
  assert.ok(ctx.invoicePath);
  const r = await api(ctx.base, 'GET', ctx.invoicePath, { token: ctx.tokens.guru });
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get('content-type') || '', /text\/html/);
  assert.ok(r.text.includes('Invoice'));
});

test('create-subscription rejects an invalid plan', async () => {
  const r = await api(ctx.base, 'POST', '/api/subscriptions/create-subscription', {
    token: ctx.tokens.bob,
    body: { plan: 'platinum' },
  });
  assert.strictEqual(r.status, 400);
});

test('verify-payment rejects a plan that does not match the order', async () => {
  await seedPendingPayment(ctx.users.bob._id, 'bronze', 'order_mismatch');
  const r = await api(ctx.base, 'POST', '/api/subscriptions/verify-payment', {
    token: ctx.tokens.bob,
    body: {
      razorpay_payment_id: 'pay_mismatch',
      razorpay_order_id: 'order_mismatch',
      razorpay_signature: 'whatever',
      plan: 'gold',
    },
  });
  assert.strictEqual(r.status, 400);
  assert.match(r.data.error, /Plan does not match/i);
});

test('verify-payment rejects orders that belong to another user', async () => {
  await seedPendingPayment(ctx.users.alice._id, 'bronze', 'order_owner');
  const r = await api(ctx.base, 'POST', '/api/subscriptions/verify-payment', {
    token: ctx.tokens.bob,
    body: {
      razorpay_payment_id: 'pay_owner',
      razorpay_order_id: 'order_owner',
      razorpay_signature: 'x',
      plan: 'bronze',
    },
  });
  assert.strictEqual(r.status, 403);
});

test('verify-payment succeeds with a valid signature, replay is blocked', async () => {
  await seedPendingPayment(ctx.users.bob._id, 'bronze', 'order_replay');
  const sig = hmac('order_replay', 'pay_replay');

  const ok = await api(ctx.base, 'POST', '/api/subscriptions/verify-payment', {
    token: ctx.tokens.bob,
    body: {
      razorpay_payment_id: 'pay_replay',
      razorpay_order_id: 'order_replay',
      razorpay_signature: sig,
      plan: 'bronze',
    },
  });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.data.subscription.status, 'active');

  const replay = await api(ctx.base, 'POST', '/api/subscriptions/verify-payment', {
    token: ctx.tokens.bob,
    body: {
      razorpay_payment_id: 'pay_replay',
      razorpay_order_id: 'order_replay',
      razorpay_signature: sig,
      plan: 'bronze',
    },
  });
  assert.notStrictEqual(replay.status, 200, 'replayed payment must be rejected');
});

// ---------------------------------------------------------------------------
// FEED
// ---------------------------------------------------------------------------

test('personalized feed paginates without duplicates', async () => {
  const p1 = await api(ctx.base, 'GET', '/api/feed/personalized?page=1&limit=5', { token: ctx.tokens.alice });
  const p2 = await api(ctx.base, 'GET', '/api/feed/personalized?page=2&limit=5', { token: ctx.tokens.alice });
  assert.strictEqual(p1.status, 200);
  assert.strictEqual(p2.status, 200);
  assert.ok(p1.data.pagination.total >= 6, 'need at least 6 posts for pagination');
  assert.strictEqual(p1.data.posts.length, 5);
  assert.strictEqual(p1.data.pagination.page, 1);
  assert.strictEqual(p1.data.pagination.hasMore, true);

  const ids1 = new Set(p1.data.posts.map((p) => p._id.toString()));
  for (const p of p2.data.posts) {
    assert.ok(!ids1.has(p._id.toString()), `post ${p._id} appeared on both pages`);
  }
  const expectedP2 = Math.min(5, p1.data.pagination.total - 5);
  assert.strictEqual(p2.data.posts.length, expectedP2);
});

test('trending feed works anonymously, paginates distinctly, and is sorted by score', async () => {
  const p1 = await api(ctx.base, 'GET', '/api/feed/trending?page=1&limit=5');
  const p2 = await api(ctx.base, 'GET', '/api/feed/trending?page=2&limit=5');
  assert.strictEqual(p1.status, 200);
  assert.strictEqual(p2.status, 200);
  assert.ok(p1.data.pagination.total >= 10, 'need at least 10 posts for two full trending pages');
  assert.strictEqual(p1.data.posts.length, 5);
  assert.strictEqual(p2.data.posts.length, 5);

  const ids1 = new Set(p1.data.posts.map((p) => p._id.toString()));
  for (const p of p2.data.posts) assert.ok(!ids1.has(p._id.toString()));

  const scores = p1.data.posts.map((p) => p.engagementScore);
  for (let i = 1; i < scores.length; i++) {
    assert.ok(scores[i] <= scores[i - 1], 'trending feed must be sorted by engagement score descending');
  }
});

test('personalized feed filters by hashtag', async () => {
  const r = await api(ctx.base, 'GET', '/api/feed/personalized?hashtag=nodejs&limit=50', { token: ctx.tokens.alice });
  assert.strictEqual(r.status, 200);
  assert.ok(r.data.posts.length >= 1);
  for (const p of r.data.posts) {
    assert.ok(p.hashtags.includes('nodejs'), `post ${p._id} missing hashtag nodejs`);
  }
});

// ---------------------------------------------------------------------------
// POSTS & REPUTATION
// ---------------------------------------------------------------------------

test('free plan is limited to 1 post per day across ALL post types', async () => {
  const q1 = await post(ctx.tokens.newbie, 'free question #nodejs', 'question');
  assert.strictEqual(q1.status, 201);
  const q2 = await post(ctx.tokens.newbie, 'free question two #nodejs', 'question');
  assert.strictEqual(q2.status, 429, 'second question for a free user should hit the daily quota');
  const normal = await post(ctx.tokens.newbie, 'just a regular post #nodejs');
  assert.strictEqual(normal.status, 429, 'non-question posts must also count against the daily post quota');
});

test('post create, edit own, delete own', async () => {
  const created = await post(ctx.tokens.alice, 'Hello world #nodejs');
  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.data.post.postType, 'post');
  assert.ok(created.data.post.hashtags.includes('nodejs'));

  const edited = await api(ctx.base, 'PUT', `/api/posts/${created.data.post._id}`, {
    token: ctx.tokens.alice,
    body: { content: 'Edited content #nodejs' },
  });
  assert.strictEqual(edited.status, 200);
  assert.strictEqual(edited.data.post.isEdited, true);

  const deleted = await api(ctx.base, 'DELETE', `/api/posts/${created.data.post._id}`, { token: ctx.tokens.alice });
  assert.strictEqual(deleted.status, 200);
  const gone = await api(ctx.base, 'GET', `/api/posts/${created.data.post._id}`, { token: ctx.tokens.alice });
  assert.strictEqual(gone.status, 404);
});

test('community edits require 100 reputation', async () => {
  const created = await post(ctx.tokens.bob, 'editable post #nodejs');
  const id = created.data.post._id;

  const denied = await api(ctx.base, 'PUT', `/api/posts/${id}`, {
    token: ctx.tokens.alice,
    body: { content: 'low rep tries to edit' },
  });
  assert.strictEqual(denied.status, 403);

  const allowed = await api(ctx.base, 'PUT', `/api/posts/${id}`, {
    token: ctx.tokens.charlie,
    body: { content: 'edited by charlie #nodejs' },
  });
  assert.strictEqual(allowed.status, 200);
});

test('comments are capped at 3/day below 50 reputation, unrestricted at 50+', async () => {
  const created = await post(ctx.tokens.bob, 'comment target #nodejs');
  const id = created.data.post._id;

  for (let i = 1; i <= 3; i++) {
    const c = await api(ctx.base, 'POST', `/api/posts/${id}/comments`, {
      token: ctx.tokens.dave,
      body: { text: `dave comment ${i}` },
    });
    assert.strictEqual(c.status, 201, `dave comment ${i} should succeed`);
  }
  const capped = await api(ctx.base, 'POST', `/api/posts/${id}/comments`, {
    token: ctx.tokens.dave,
    body: { text: 'dave comment 4 - should be blocked' },
  });
  assert.strictEqual(capped.status, 429);

  for (let i = 1; i <= 4; i++) {
    const c = await api(ctx.base, 'POST', `/api/posts/${id}/comments`, {
      token: ctx.tokens.bob,
      body: { text: `bob comment ${i}` },
    });
    assert.strictEqual(c.status, 201, `bob comment ${i} should succeed`);
  }
});

test('downvote applies -2 and reverting applies +2 (net zero)', async () => {
  const created = await post(ctx.tokens.bob, 'downvote target #nodejs');
  const id = created.data.post._id;
  const before = await repOf('bob');

  const dv = await api(ctx.base, 'POST', `/api/posts/${id}/downvote`, { token: ctx.tokens.alice });
  assert.strictEqual(dv.status, 200);
  assert.strictEqual(dv.data.downvoted, true);
  assert.strictEqual(await repOf('bob'), before - 2);

  const reverted = await api(ctx.base, 'POST', `/api/posts/${id}/downvote`, { token: ctx.tokens.alice });
  assert.strictEqual(reverted.status, 200);
  assert.strictEqual(reverted.data.downvoted, false);
  assert.strictEqual(await repOf('bob'), before, 'downvote + revert must net to zero');
});

test('answer reaching 5 upvotes awards +5 exactly once (idempotent)', async () => {
  const created = await post(ctx.tokens.charlie, 'the answer to everything #nodejs', 'answer');
  const id = created.data.post._id;
  const before = await repOf('charlie');

  for (const liker of ['alice', 'dave', 'erin', 'bob', 'guru']) {
    const l = await api(ctx.base, 'POST', `/api/posts/${id}/like`, { token: ctx.tokens[liker] });
    assert.strictEqual(l.status, 200);
  }
  assert.strictEqual(await repOf('charlie'), before + 5, 'answer_5_upvotes should award +5');

  const daveUnlike = await api(ctx.base, 'POST', `/api/posts/${id}/like`, { token: ctx.tokens.dave });
  assert.strictEqual(daveUnlike.data.liked, false);
  const daveRelike = await api(ctx.base, 'POST', `/api/posts/${id}/like`, { token: ctx.tokens.dave });
  assert.strictEqual(daveRelike.data.liked, true);
  assert.strictEqual(await repOf('charlie'), before + 5, 'bonus must not be awarded twice for the same post');

  const ReputationLog = ctx.mongoose.model('ReputationLog');
  const count = await ReputationLog.countDocuments({ user: ctx.users.charlie._id, reason: 'answer_5_upvotes', referenceId: id });
  assert.strictEqual(count, 1);
});

test('question reaching 10 upvotes awards +2 exactly once (idempotent)', async () => {
  const created = await post(ctx.tokens.alice, 'big #nodejs question', 'question');
  const id = created.data.post._id;
  const before = await repOf('alice');

  const likers = ['charlie', 'bob', 'guru', 'dave', 'erin', 'admin', 'qliker1', 'qliker2', 'qliker3', 'fliker'];
  for (const liker of likers) {
    const l = await api(ctx.base, 'POST', `/api/posts/${id}/like`, { token: ctx.tokens[liker] });
    assert.strictEqual(l.status, 200, `liker ${liker}`);
  }
  assert.strictEqual(await repOf('alice'), before + 2, 'question_10_upvotes should award +2');

  const flikerUnlike = await api(ctx.base, 'POST', `/api/posts/${id}/like`, { token: ctx.tokens.fliker });
  assert.strictEqual(flikerUnlike.data.liked, false);
  const flikerRelike = await api(ctx.base, 'POST', `/api/posts/${id}/like`, { token: ctx.tokens.fliker });
  assert.strictEqual(flikerRelike.data.liked, true);
  assert.strictEqual(await repOf('alice'), before + 2, 'bonus must not be awarded twice for the same post');
});

test('accept-answer awards +10 once, then rejects repeats', async () => {
  const q = await post(ctx.tokens.alice, 'question to accept #nodejs', 'question');
  const a = await post(ctx.tokens.charlie, 'an answer to accept #nodejs', 'answer');
  const qId = q.data.post._id;
  const aId = a.data.post._id;
  const before = await repOf('charlie');

  const accept = await api(ctx.base, 'POST', `/api/posts/${qId}/accept-answer`, {
    token: ctx.tokens.alice,
    body: { answerId: aId },
  });
  assert.strictEqual(accept.status, 200);
  assert.strictEqual(await repOf('charlie'), before + 10, 'accepted_answer should award +10');

  const again = await api(ctx.base, 'POST', `/api/posts/${qId}/accept-answer`, {
    token: ctx.tokens.alice,
    body: { answerId: aId },
  });
  assert.strictEqual(again.status, 400);

  const ReputationLog = ctx.mongoose.model('ReputationLog');
  const count = await ReputationLog.countDocuments({ user: ctx.users.charlie._id, reason: 'accepted_answer', referenceId: aId });
  assert.strictEqual(count, 1);
});

test('close-vote requires 250 reputation and forbids own question', async () => {
  const q = await post(ctx.tokens.alice, 'question to close #nodejs', 'question');
  const qId = q.data.post._id;

  const denied = await api(ctx.base, 'POST', `/api/posts/${qId}/close-vote`, { token: ctx.tokens.charlie });
  assert.strictEqual(denied.status, 403);

  const allowed = await api(ctx.base, 'POST', `/api/posts/${qId}/close-vote`, { token: ctx.tokens.bob });
  assert.strictEqual(allowed.status, 200);
  assert.strictEqual(allowed.data.closeVotes, 1);

  const ownQ = await post(ctx.tokens.bob, 'my own #nodejs question', 'question');
  const own = await api(ctx.base, 'POST', `/api/posts/${ownQ.data.post._id}/close-vote`, { token: ctx.tokens.bob });
  assert.strictEqual(own.status, 400);
});

test('reporting a post requires 500 reputation and follows report rules', async () => {
  // alice creates the post; guru (>=500 reputation) reports it.
  const target = await post(ctx.tokens.alice, 'reportable post #nodejs');
  const targetId = target.data.post._id;

  // Reporting is a privilege unlocked at 500 reputation.
  const byHighRep = await api(ctx.base, 'POST', `/api/admin/posts/${targetId}/report`, {
    token: ctx.tokens.guru,
    body: { reason: 'spam' },
  });
  assert.strictEqual(byHighRep.status, 201);

  // Duplicate report by the same user is rejected.
  const duplicate = await api(ctx.base, 'POST', `/api/admin/posts/${targetId}/report`, {
    token: ctx.tokens.guru,
    body: { reason: 'spam' },
  });
  assert.strictEqual(duplicate.status, 409);

  // A user below 500 reputation cannot report (privilege gate).
  const lowRep = await api(ctx.base, 'POST', `/api/admin/posts/${targetId}/report`, {
    token: ctx.tokens.bob,
    body: { reason: 'spam' },
  });
  assert.strictEqual(lowRep.status, 403);

  // A user cannot report their own post.
  const ownPost = await post(ctx.tokens.guru, 'my own reportable post #nodejs');
  const own = await api(ctx.base, 'POST', `/api/admin/posts/${ownPost.data.post._id}/report`, {
    token: ctx.tokens.guru,
    body: { reason: 'spam' },
  });
  assert.strictEqual(own.status, 400);
});

test('reputation transfer enforces min rep, 50/tx, and 100/day', async () => {
  const beforeBob = await repOf('bob');
  const beforeErin = await repOf('erin');

  const t1 = await api(ctx.base, 'POST', '/api/reputation/transfer', {
    token: ctx.tokens.bob,
    body: { receiverUsername: 'erin', amount: 50, reason: 'helping out' },
  });
  assert.strictEqual(t1.status, 200);
  assert.strictEqual(await repOf('bob'), beforeBob - 50);
  assert.strictEqual(await repOf('erin'), beforeErin + 50);

  const t2 = await api(ctx.base, 'POST', '/api/reputation/transfer', {
    token: ctx.tokens.bob,
    body: { receiverUsername: 'erin', amount: 51, reason: 'too much' },
  });
  assert.strictEqual(t2.status, 400, 'max 50 per transaction');

  const t3 = await api(ctx.base, 'POST', '/api/reputation/transfer', {
    token: ctx.tokens.bob,
    body: { receiverUsername: 'erin', amount: 50, reason: 'reaching the daily cap' },
  });
  assert.strictEqual(t3.status, 200, 'transfers up to exactly 100/day are allowed');
  assert.strictEqual(await repOf('bob'), beforeBob - 100);
  assert.strictEqual(await repOf('erin'), beforeErin + 100);

  const t4 = await api(ctx.base, 'POST', '/api/reputation/transfer', {
    token: ctx.tokens.bob,
    body: { receiverUsername: 'erin', amount: 1, reason: 'over the daily cap' },
  });
  assert.strictEqual(t4.status, 429, 'daily transfer limit of 100 must not be exceeded');

  const low = await api(ctx.base, 'POST', '/api/reputation/transfer', {
    token: ctx.tokens.alice,
    body: { receiverUsername: 'erin', amount: 1, reason: 'low rep' },
  });
  assert.strictEqual(low.status, 403, 'sender must have more than 50 rep');

  const unknown = await api(ctx.base, 'POST', '/api/reputation/transfer', {
    token: ctx.tokens.guru,
    body: { receiverUsername: 'ghost', amount: 10, reason: 'nobody' },
  });
  assert.strictEqual(unknown.status, 404);

  const self = await api(ctx.base, 'POST', '/api/reputation/transfer', {
    token: ctx.tokens.guru,
    body: { receiverUsername: 'guru', amount: 10, reason: 'self' },
  });
  assert.strictEqual(self.status, 400, 'cannot transfer to yourself');

  const canBob = await api(ctx.base, 'GET', '/api/reputation/can-transfer', { token: ctx.tokens.bob });
  assert.strictEqual(canBob.data.canTransfer, true);
  assert.strictEqual(canBob.data.dailyUsed, 100);
  const canAlice = await api(ctx.base, 'GET', '/api/reputation/can-transfer', { token: ctx.tokens.alice });
  assert.strictEqual(canAlice.data.canTransfer, false);

  const history = await api(ctx.base, 'GET', `/api/reputation/history/${ctx.users.bob._id}`, { token: ctx.tokens.bob });
  assert.strictEqual(history.status, 200);
  assert.ok(history.data.logs.some((l) => l.reason === 'transfer_sent'));
});

// ---------------------------------------------------------------------------
// LANGUAGE & OTP
// ---------------------------------------------------------------------------

test('language switch sends OTP via email (fr) and changes the language', async () => {
  const request = await api(ctx.base, 'POST', '/api/language/request', {
    token: ctx.tokens.alice,
    body: { language: 'fr' },
  });
  assert.strictEqual(request.status, 200);
  assert.strictEqual(request.data.type, 'email');
  assert.strictEqual(request.data.code, undefined, 'OTP must not be returned in the response');

  const otpDoc = await latestOtp(ctx.users.alice._id, 'language_switch');
  assert.ok(otpDoc, 'language OTP should be persisted');
  const preview = otpService.getTestOtpPreview(ctx.users.alice._id, 'language_switch');
  assert.ok(preview, 'language OTP preview unavailable (NODE_ENV must be "test")');

  const verify = await api(ctx.base, 'POST', '/api/language/verify', {
    token: ctx.tokens.alice,
    body: { language: 'fr', otp: preview.code },
  });
  assert.strictEqual(verify.status, 200);
  assert.strictEqual(verify.data.user.language, 'fr');

  const User = ctx.mongoose.model('User');
  await User.findByIdAndUpdate(ctx.users.alice._id, { language: 'en' });
});

test('language switch to a non-French language requires a registered mobile number', async () => {
  const User = ctx.mongoose.model('User');
  await User.findByIdAndUpdate(ctx.users.alice._id, { $unset: { phone: 1 } });
  const denied = await api(ctx.base, 'POST', '/api/language/request', {
    token: ctx.tokens.alice,
    body: { language: 'es' },
  });
  assert.strictEqual(denied.status, 400);
  assert.strictEqual(denied.data.missingField, 'phone');
});

test('language switch to a non-French language is verified via mobile (SMS/WhatsApp) OTP', async () => {
  const User = ctx.mongoose.model('User');
  await User.findByIdAndUpdate(ctx.users.alice._id, { phone: '+15550001111' });

  // Ensure no leftover (unverified) language_switch OTP from a prior test blocks
  // this request via the resend cooldown.
  await ctx.mongoose.model('Otp').deleteMany({ user: ctx.users.alice._id, purpose: 'language_switch' });

  // Simulate a configured, working WhatsApp provider so the non-French OTP is
  // actually delivered via WhatsApp (the intended path). We mock the Meta Graph
  // API call so the test does not depend on network/credentials, and we restore
  // everything afterwards to avoid leaking into other tests.
  process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '12345';
  const axios = require('axios');
  const originalPost = axios.post;
  axios.post = async () => ({ data: { messages: [{ id: 'wamid.test' }] } });

  try {
    const request = await api(ctx.base, 'POST', '/api/language/request', {
      token: ctx.tokens.alice,
      body: { language: 'pt' },
    });
    assert.strictEqual(request.status, 200);
    assert.strictEqual(request.data.type, 'phone', 'requested type stays phone');
    assert.strictEqual(request.data.channel, 'phone', 'actual delivery channel is phone (WhatsApp)');
    assert.strictEqual(request.data.delivery.channel, 'phone');
    assert.strictEqual(request.data.delivery.method, 'whatsapp');
    assert.strictEqual(request.data.code, undefined, 'the OTP must never be returned');
    assert.strictEqual(request.data.delivery.contact, '+15550001111');

    const preview = otpService.getTestOtpPreview(ctx.users.alice._id, 'language_switch');
    assert.ok(preview, 'language OTP preview unavailable (NODE_ENV must be "test")');

    const verify = await api(ctx.base, 'POST', '/api/language/verify', {
      token: ctx.tokens.alice,
      body: { language: 'pt', otp: preview.code },
    });
    assert.strictEqual(verify.status, 200);
    assert.strictEqual(verify.data.user.language, 'pt');

    await User.findByIdAndUpdate(ctx.users.alice._id, { language: 'en' });

    const noCreds = await api(ctx.base, 'POST', '/api/language/verify', {
      token: ctx.tokens.alice,
      body: { language: 'pt' },
    });
    assert.strictEqual(noCreds.status, 400, 'verification requires an otp');
  } finally {
    axios.post = originalPost;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    await User.findByIdAndUpdate(ctx.users.alice._id, { $unset: { phone: 1 } });
  }
});

test('language switch rejects invalid language', async () => {
  const r = await api(ctx.base, 'POST', '/api/language/request', {
    token: ctx.tokens.alice,
    body: { language: 'xx' },
  });
  assert.strictEqual(r.status, 400);
});

test('OTP locks after 5 failed attempts', async () => {
  const request = await api(ctx.base, 'POST', '/api/otp/request', {
    token: ctx.tokens.alice,
    body: { purpose: 'email_verification', type: 'email' },
  });
  assert.strictEqual(request.status, 200);

  const otpDoc = await latestOtp(ctx.users.alice._id, 'email_verification');
  assert.ok(otpDoc);
  assert.strictEqual(otpDoc.code, undefined, 'plaintext code must never be stored');
  assert.match(otpDoc.codeHash || '', /^[0-9a-f]{64}$/, 'OTP must be stored as an HMAC-SHA256 hash');
  const preview = otpService.getTestOtpPreview(ctx.users.alice._id, 'email_verification');
  assert.ok(preview, 'email_verification OTP preview unavailable (NODE_ENV must be "test")');
  assert.notStrictEqual(otpDoc.codeHash, preview.code, 'the stored hash must differ from the plaintext code');

  // Wrong codes are 400 (MISMATCH) until the cap; the attempt that reaches the
  // cap locks the OTP and returns 429 (LOCKED).
  for (let i = 0; i < 5; i++) {
    const r = await api(ctx.base, 'POST', '/api/otp/verify', {
      token: ctx.tokens.alice,
      body: { purpose: 'email_verification', code: '000000' },
    });
    assert.strictEqual(r.status, i < 4 ? 400 : 429, `wrong-code attempt ${i + 1}`);
  }

  const afterLock = await api(ctx.base, 'POST', '/api/otp/verify', {
    token: ctx.tokens.alice,
    body: { purpose: 'email_verification', code: '000000' },
  });
  assert.strictEqual(afterLock.status, 400, 'further attempts after lockout are rejected');

  const finalDoc = await ctx.mongoose.model('Otp').findOne({ _id: otpDoc._id });
  assert.ok(finalDoc.attempts >= 5, 'attempts counter should reach 5');

  const correctNowBlocked = await api(ctx.base, 'POST', '/api/otp/verify', {
    token: ctx.tokens.alice,
    body: { purpose: 'email_verification', code: preview.code },
  });
  assert.strictEqual(correctNowBlocked.status, 400, 'correct code must be rejected after lockout');
});

// ---------------------------------------------------------------------------
// WEBHOOK
// ---------------------------------------------------------------------------

test('razorpay webhook returns 503 when no secret is configured', async () => {
  const body = JSON.stringify({ event: 'payment.captured', payload: {} });
  const r = await api(ctx.base, 'POST', '/api/webhook/razorpay', { rawBody: body });
  assert.strictEqual(r.status, 503);
});

test('razorpay webhook rejects an invalid signature when a secret is configured', async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
  const body = JSON.stringify({ event: 'payment.captured', payload: {} });
  const r = await api(ctx.base, 'POST', '/api/webhook/razorpay', {
    rawBody: body,
    headers: { 'x-razorpay-signature': 'deadbeef' },
  });
  assert.strictEqual(r.status, 400);
});
