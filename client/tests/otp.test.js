const { test, before, after } = require('node:test');
const assert = require('node:assert');

// Keep the per-IP budgets small so the rate-limit assertions at the end of
// this file don't need hundreds of requests. All request/verify counters below
// are budgeted against these values.
process.env.RATE_LIMIT_OTP_REQUEST_MAX = '15';
process.env.RATE_LIMIT_OTP_VERIFY_MAX = '15';

const { boot, api, UA_A, UA_B } = require('./helpers');
const otpService = require('../src/server/utils/otpService');

const ctx = {};
const OTP_REQUEST_LIMIT = 15;
const OTP_VERIFY_LIMIT = 15;

async function latestOtp(userId, purpose) {
  const Otp = ctx.mongoose.model('Otp');
  return Otp.findOne({ user: userId, purpose }).sort({ createdAt: -1 });
}

// Simulate expiry so a fresh request does not trip the 60s resend cooldown.
async function clearActiveOtps(userId, purpose) {
  const Otp = ctx.mongoose.model('Otp');
  await Otp.deleteMany({ user: userId, purpose, verified: false });
}

before(async () => {
  const h = await boot();
  Object.assign(ctx, h);
  ctx.token = null;
  ctx.userId = null;

  const r = await api(ctx.base, 'POST', '/api/auth/register', {
    body: { username: 'otpuser', email: 'otpuser@test.com', password: 'OtpUser123!', displayName: 'Otp User', phone: '+15550001111' },
  });
  assert.strictEqual(r.status, 201, `register failed: ${r.data?.error || r.status}`);
  ctx.token = r.data.token;
  ctx.userId = r.data.user._id;
});

after(async () => {
  if (ctx.close) await ctx.close();
});

test('request returns metadata only (never the code), then verify succeeds', async () => {
  const request = await api(ctx.base, 'POST', '/api/otp/request', {
    token: ctx.token,
    body: { purpose: 'email_verification', type: 'email' },
  });
  assert.strictEqual(request.status, 200);
  assert.strictEqual(request.data.code, undefined, 'OTP code must never appear in a response');
  assert.ok(request.data.expiresInMs > 0 && request.data.expiresInMs <= 5 * 60 * 1000, 'expiry should be ~5 minutes');

  const preview = otpService.getTestOtpPreview(ctx.userId, 'email_verification');
  assert.ok(preview, 'preview unavailable (is NODE_ENV=test?)');
  assert.match(preview.code, /^\d{6}$/, 'OTP must be a 6-digit numeric code');

  const doc = await latestOtp(ctx.userId, 'email_verification');
  assert.strictEqual(doc.code, undefined, 'plaintext code must never be persisted');
  assert.match(doc.codeHash || '', /^[0-9a-f]{64}$/, 'only a hash of the OTP may be stored');
  assert.notStrictEqual(doc.codeHash, preview.code, 'stored hash must differ from the plaintext code');

  const status = await api(ctx.base, 'POST', '/api/otp/status', {
    token: ctx.token,
    body: { purpose: 'email_verification' },
  });
  assert.strictEqual(status.status, 200);
  assert.strictEqual(status.data.active, true);

  const verify = await api(ctx.base, 'POST', '/api/otp/verify', {
    token: ctx.token,
    body: { purpose: 'email_verification', code: preview.code },
  });
  assert.strictEqual(verify.status, 200);
  assert.strictEqual(verify.data.verified, true);
});

test('resend cooldown rejects a second request with 429 and retryAfterMs', async () => {
  const request = await api(ctx.base, 'POST', '/api/otp/request', {
    token: ctx.token,
    body: { purpose: 'email_verification', type: 'email' },
  });
  assert.strictEqual(request.status, 200);

  const again = await api(ctx.base, 'POST', '/api/otp/request', {
    token: ctx.token,
    body: { purpose: 'email_verification', type: 'email' },
  });
  assert.strictEqual(again.status, 429);
  assert.strictEqual(again.data.code, 'RESEND_COOLDOWN');
  assert.ok(again.data.retryAfterMs > 0, 'cooldown response should include retryAfterMs');

  const resend = await api(ctx.base, 'POST', '/api/otp/resend', {
    token: ctx.token,
    body: { purpose: 'email_verification', type: 'email' },
  });
  assert.strictEqual(resend.status, 429, 'resend must also respect the cooldown');
});

test('an OTP can only be used once', async () => {
  await clearActiveOtps(ctx.userId, 'email_verification');
  const request = await api(ctx.base, 'POST', '/api/otp/request', {
    token: ctx.token,
    body: { purpose: 'email_verification', type: 'email' },
  });
  assert.strictEqual(request.status, 200);
  const preview = otpService.getTestOtpPreview(ctx.userId, 'email_verification');
  assert.ok(preview);

  const first = await api(ctx.base, 'POST', '/api/otp/verify', {
    token: ctx.token,
    body: { purpose: 'email_verification', code: preview.code },
  });
  assert.strictEqual(first.status, 200);

  const replay = await api(ctx.base, 'POST', '/api/otp/verify', {
    token: ctx.token,
    body: { purpose: 'email_verification', code: preview.code },
  });
  assert.strictEqual(replay.status, 400, 'a consumed OTP must be rejected');
  assert.notStrictEqual(replay.data.code, 'VALIDATION_ERROR');
});

test('wrong code increments attempts and reports remaining; correct code still works', async () => {
  const request = await api(ctx.base, 'POST', '/api/otp/request', {
    token: ctx.token,
    body: { purpose: 'email_verification', type: 'email' },
  });
  assert.strictEqual(request.status, 200);
  const preview = otpService.getTestOtpPreview(ctx.userId, 'email_verification');
  assert.ok(preview);

  const wrong = await api(ctx.base, 'POST', '/api/otp/verify', {
    token: ctx.token,
    body: { purpose: 'email_verification', code: '000000' },
  });
  assert.strictEqual(wrong.status, 400);
  assert.strictEqual(wrong.data.code, 'MISMATCH');
  assert.strictEqual(wrong.data.attemptsRemaining, otpService.MAX_OTP_ATTEMPTS - 1);

  const ok = await api(ctx.base, 'POST', '/api/otp/verify', {
    token: ctx.token,
    body: { purpose: 'email_verification', code: preview.code },
  });
  assert.strictEqual(ok.status, 200);
});

test('validation rejects bad purpose, missing body, and malformed codes', async () => {
  const badPurpose = await api(ctx.base, 'POST', '/api/otp/request', {
    token: ctx.token,
    body: { purpose: 'not_a_purpose', type: 'email' },
  });
  assert.strictEqual(badPurpose.status, 400);
  assert.strictEqual(badPurpose.data.code, 'VALIDATION_ERROR');

  const missing = await api(ctx.base, 'POST', '/api/otp/request', { token: ctx.token, body: {} });
  assert.strictEqual(missing.status, 400);
  assert.strictEqual(missing.data.code, 'VALIDATION_ERROR');

  const badCode = await api(ctx.base, 'POST', '/api/otp/verify', {
    token: ctx.token,
    body: { purpose: 'email_verification', code: 'abc' },
  });
  assert.strictEqual(badCode.status, 400);
  assert.strictEqual(badCode.data.code, 'VALIDATION_ERROR');
});

test('expired OTPs are rejected', async () => {
  const request = await api(ctx.base, 'POST', '/api/otp/request', {
    token: ctx.token,
    body: { purpose: 'email_verification', type: 'email' },
  });
  assert.strictEqual(request.status, 200);
  const preview = otpService.getTestOtpPreview(ctx.userId, 'email_verification');
  assert.ok(preview);

  const Otp = ctx.mongoose.model('Otp');
  await Otp.updateOne(
    { user: ctx.userId, purpose: 'email_verification', verified: false },
    { $set: { expiresAt: new Date(Date.now() - 1000) } }
  );

  const verify = await api(ctx.base, 'POST', '/api/otp/verify', {
    token: ctx.token,
    body: { purpose: 'email_verification', code: preview.code },
  });
  assert.strictEqual(verify.status, 400);
  assert.strictEqual(verify.data.code, 'NO_ACTIVE_OTP');
});

test('OTP requests are rate limited per IP', async () => {
  let blocked = null;
  for (let i = 0; i < OTP_REQUEST_LIMIT + 2; i++) {
    await clearActiveOtps(ctx.userId, 'email_verification');
    const r = await api(ctx.base, 'POST', '/api/otp/request', {
      token: ctx.token,
      body: { purpose: 'email_verification', type: 'email' },
    });
    if (r.status === 429 && r.data.code === 'RATE_LIMITED') {
      blocked = r;
      break;
    }
  }
  assert.ok(blocked, `expected a 429 after ${OTP_REQUEST_LIMIT} requests`);
  assert.strictEqual(blocked.data.code, 'RATE_LIMITED');
  assert.ok(blocked.data.retryAfterMs > 0);
});

test('OTP verification attempts are rate limited per IP', async () => {
  let blocked = null;
  for (let i = 0; i < OTP_VERIFY_LIMIT + 3; i++) {
    const r = await api(ctx.base, 'POST', '/api/otp/verify', {
      token: ctx.token,
      body: { purpose: 'email_verification', code: '000000' },
    });
    if (r.status === 429 && r.data.code === 'RATE_LIMITED') {
      blocked = r;
      break;
    }
    // The per-OTP attempt cap returns 429 (LOCKED); those are not the rate
    // limiter and must not be mistaken for it. Once locked the code is
    // consumed (verified:true), so later tries return 400 NO_ACTIVE_OTP.
  }
  assert.ok(blocked, `expected a 429 after ${OTP_VERIFY_LIMIT} attempts`);
  assert.strictEqual(blocked.data.code, 'RATE_LIMITED');
});

test('recognized device logs in directly; new device requires OTP', async () => {
  const reg = await api(ctx.base, 'POST', '/api/auth/register', {
    ua: UA_A,
    body: { username: 'otpflow', email: 'otpflow@test.com', password: 'Flow1234!', displayName: 'Flow', phone: '+15550001234' },
  });
  assert.strictEqual(reg.status, 201);
  const otpflowId = reg.data.user._id;

  // Same (recognized) device logs in directly and returns a token.
  const known = await api(ctx.base, 'POST', '/api/auth/login', {
    ua: UA_A,
    body: { login: 'otpflow@test.com', password: 'Flow1234!' },
  });
  assert.strictEqual(known.status, 200);
  assert.strictEqual(known.data.otpRequired, undefined, 'recognized device must not require OTP');
  assert.ok(known.data.token, 'recognized login must return a session token');

  // A NEW device (different fingerprint) must be challenged with an OTP and
  // must NOT return a token until the OTP is verified.
  const login = await api(ctx.base, 'POST', '/api/auth/login', {
    ua: UA_B,
    body: { login: 'otpflow@test.com', password: 'Flow1234!' },
  });
  assert.strictEqual(login.status, 200);
  assert.strictEqual(login.data.otpRequired, true, 'new device must require OTP');
  assert.strictEqual(login.data.token, undefined, 'new device must not return a token before OTP');

  // Completing the OTP issues a trusted session token.
  const code = otpService.getTestOtpPreview(otpflowId, 'login_verification')?.code;
  const verify = await api(ctx.base, 'POST', '/api/auth/verify-login', {
    ua: UA_B,
    body: { login: 'otpflow@test.com', otp: code },
  });
  assert.strictEqual(verify.status, 200);
  assert.ok(verify.data.token, 'verify-login must return a session token');

  // Wrong password is rejected.
  const bad = await api(ctx.base, 'POST', '/api/auth/login', {
    body: { login: 'otpflow@test.com', password: 'wrong-password' },
  });
  assert.strictEqual(bad.status, 401, 'wrong password must be rejected');

  // Login by phone also works (credentials are stored per identifier).
  const byPhone = await api(ctx.base, 'POST', '/api/auth/login', {
    body: { login: '+15550001234', password: 'Flow1234!' },
  });
  assert.strictEqual(byPhone.status, 200, 'login by phone must succeed');
});
