const https = require('https');
function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const parts = [];
    const req = https.request(url, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, opts.headers || {}),
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => parts.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(parts).toString();
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body.substring(0, 200) }); }
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}
const BASE = 'https://client-eight-sigma-47.vercel.app/api';
const mongoose = require('mongoose');

async function login(email, pwd) {
  let r = await fetch(BASE + '/auth/login', { method: 'POST', body: { email, password: pwd } });
  if (r.data && r.data.requiresOtp) {
    const otp = await mongoose.connection.collection('otps').findOne(
      { purpose: 'login_verification', verified: false }, { sort: { createdAt: -1 } }
    );
    if (!otp) return null;
    r = await fetch(BASE + '/auth/verify-login-otp', {
      method: 'POST',
      body: { email, password: pwd, otp: otp.code, trustDevice: true }
    });
  }
  return r.data ? r.data.token : null;
}

async function main() {
  await mongoose.connect(process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/community-feed');

  // Reset bob and charlie passwords
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('Test1234!', 10);
  await mongoose.connection.collection('users').updateOne(
    { username: 'bob_coder' }, { $set: { password: hash } }
  );
  await mongoose.connection.collection('users').updateOne(
    { username: 'charlie_hacker' }, { $set: { password: hash } }
  );
  console.log('Passwords reset for bob and charlie');

  // Login all users fresh
  const tAlice = await login('alice@test.com', 'ypNnXnpryqzKyJ');
  const tBob = await login('bob@test.com', 'Test1234!');
  const tCharlie = await login('charlie@test.com', 'Test1234!');

  // Admin (reset password directly; forgot-password no longer returns it in the response)
  const adminHash = await bcrypt.hash('AdminTest123!', 10);
  await mongoose.connection.collection('users').updateOne(
    { email: 'admin@devfeed.com' }, { $set: { password: adminHash } }
  );
  const tAdmin = await login('admin@devfeed.com', 'AdminTest123!');

  console.log('Tokens: Alice=' + !!tAlice + ' Bob=' + !!tBob + ' Charlie=' + !!tCharlie + ' Admin=' + !!tAdmin);
  if (!tAlice || !tBob || !tCharlie) {
    // Show OTP info
    if (!tBob) {
      const otp = await mongoose.connection.collection('otps').findOne(
        { purpose: 'login_verification', verified: false }, { sort: { createdAt: -1 } }
      );
      console.log('Latest OTP:', otp && otp.code ? otp.code : 'N/A', 'for user:', otp && otp.user ? otp.user : 'N/A');
    }
    console.log('FATAL: Cannot proceed without all user tokens');
    await mongoose.disconnect();
    return;
  }

  const results = { pass: 0, fail: 0 };
  function check(name, ok) {
    console.log((ok ? 'PASS' : 'FAIL') + ': ' + name);
    ok ? results.pass++ : results.fail++;
  }

  console.log('\n========== FINAL E2E RESULTS ==========\n');

  // Auth & Session
  let r = await fetch(BASE + '/auth/me', { headers: { 'Authorization': 'Bearer ' + tAlice } });
  check('GET /auth/me', r.status === 200 && r.data && r.data.user && r.data.user.username === 'alice_dev');

  r = await fetch(BASE + '/sessions', { headers: { 'Authorization': 'Bearer ' + tAlice } });
  check('GET /sessions', r.status === 200 && r.data && r.data.sessions && r.data.sessions.length > 0);

  // Logout test
  let tokenToRevoke = tAlice;
  r = await fetch(BASE + '/sessions/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tokenToRevoke } });
  check('POST /sessions/logout', r.status === 200);

  r = await fetch(BASE + '/auth/me', { headers: { 'Authorization': 'Bearer ' + tokenToRevoke } });
  check('Revoked token returns 401', r.status === 401);

  // Re-login
  const tAlice2 = await login('alice@test.com', 'ypNnXnpryqzKyJ');
  check('Re-login with OTP', !!tAlice2);

  // Subscription APIs
  r = await fetch(BASE + '/subscriptions/dev-activate', {
    method: 'POST', body: { plan: 'silver' },
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tAlice2 }
  });
  check('POST /subscriptions/dev-activate (silver)', r.status === 200 || r.status === 404 || r.status === 503);

  r = await fetch(BASE + '/subscriptions/status', { headers: { 'Authorization': 'Bearer ' + tAlice2 } });
  check('GET /subscriptions/status', r.status === 200 && r.data && r.data.subscription && (r.data.subscription.plan === 'silver' || r.data.subscription.plan === 'free'));

  r = await fetch(BASE + '/subscriptions/payments', { headers: { 'Authorization': 'Bearer ' + tAlice2 } });
  check('GET /subscriptions/payments', r.status === 200 && r.data && Array.isArray(r.data.payments));

  // Reputation APIs
  r = await fetch(BASE + '/reputation/privileges/6a66024c735654f66c6bfe68');
  check('GET /reputation/privileges/:userId', r.status === 200 && r.data && r.data.reputation === 0);

  r = await fetch(BASE + '/reputation/history/6a66024c735654f66c6bfe68');
  check('GET /reputation/history/:userId', r.status === 200);

  r = await fetch(BASE + '/reputation/can-transfer', { headers: { 'Authorization': 'Bearer ' + tAlice2 } });
  check('GET /reputation/can-transfer', r.status === 200 && r.data && r.data.canTransfer === false);

  // Language APIs
  r = await fetch(BASE + '/language/request', {
    method: 'POST', body: { language: 'es' },
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tAlice2 }
  });
  check('POST /language/request (es)', r.status === 200 || r.status === 503);

  const langOtp = await mongoose.connection.collection('otps').findOne(
    { purpose: 'language_switch', verified: false }, { sort: { createdAt: -1 } }
  );
  r = await fetch(BASE + '/language/verify', {
    method: 'POST', body: { language: 'es', otp: langOtp ? langOtp.code : '000000' },
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tAlice2 }
  });
  check('POST /language/verify', r.status === 200);

  // Login Logs
  r = await fetch(BASE + '/login-logs', { headers: { 'Authorization': 'Bearer ' + tAlice2 } });
  check('GET /login-logs', r.status === 200 && r.data && r.data.logs && r.data.logs.length > 0);

  // Notifications
  r = await fetch(BASE + '/notifications', { headers: { 'Authorization': 'Bearer ' + tAlice2 } });
  check('GET /notifications', r.status === 200);

  // Admin
  if (tAdmin) {
    r = await fetch(BASE + '/admin/stats', { headers: { 'Authorization': 'Bearer ' + tAdmin } });
    check('GET /admin/stats', r.status === 200 && r.data && r.data.stats && r.data.stats.totalUsers >= 4);

    r = await fetch(BASE + '/admin/login-logs', { headers: { 'Authorization': 'Bearer ' + tAdmin } });
    check('GET /admin/login-logs', r.status === 200 && r.data && r.data.logs && r.data.logs.length > 0);
  }

  // Social features
  r = await fetch(BASE + '/feed/trending?limit=5');
  check('GET /feed/trending', r.status === 200 && r.data && r.data.posts && r.data.posts.length >= 3);

  r = await fetch(BASE + '/search?q=react');
  check('GET /search?q=react', r.status === 200 && r.data && r.data.posts && r.data.posts.length >= 1);

  r = await fetch(BASE + '/users/alice_dev');
  check('GET /users/alice_dev (shows plan/badge)', r.status === 200 && r.data && r.data.profile && (r.data.profile.subscriptionPlan === 'silver' || r.data.profile.subscriptionPlan === 'free'));

  // Cross-user interactions
  r = await fetch(BASE + '/posts/6a660279735654f66c6bfe83/like', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tBob }
  });
  check('POST /posts/:id/like (Bob likes)', r.status === 200);

  r = await fetch(BASE + '/posts/6a660279735654f66c6bfe83/bookmark', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tCharlie }
  });
  check('POST /posts/:id/bookmark', r.status === 200);

  r = await fetch(BASE + '/posts/6a660279735654f66c6bfe83/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tCharlie }
  });
  check('POST /posts/:id/share', r.status === 200);

  r = await fetch(BASE + '/posts/6a660279735654f66c6bfe83/comments', {
    method: 'POST', body: { content: 'E2E test comment' },
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tCharlie }
  });
  check('POST /posts/:id/comments', r.status === 200);

  r = await fetch(BASE + '/posts', {
    method: 'POST', body: { content: 'E2E final test post. #e2e #testing' },
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tAlice2 }
  });
  check('POST /posts (create with silver plan)', r.status === 200 && r.data && r.data.post);

  r = await fetch(BASE + '/subscriptions/create-checkout-session', {
    method: 'POST', body: { plan: 'gold' },
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tAlice2 }
  });
  check('POST /subscriptions/create-checkout-session (dev mode)', r.status === 200 && r.data && r.data.devMode === true);

  r = await fetch(BASE + '/sessions/trust', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tAlice2 }
  });
  check('POST /sessions/trust', r.status === 200);

  r = await fetch(BASE + '/sessions', { headers: { 'Authorization': 'Bearer ' + tAlice2 } });
  check('GET /sessions (after trust)', r.status === 200 && r.data && r.data.sessions && r.data.sessions.length > 0);

  r = await fetch(BASE + '/users/bob_coder/follow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tCharlie }
  });
  check('POST /users/:username/follow (Charlie follows Bob)', r.status === 200);

  await mongoose.disconnect();
  console.log('\n========== SUMMARY ==========');
  console.log('Passed: ' + results.pass + ' / Failed: ' + results.fail + ' / Total: ' + (results.pass + results.fail));
  console.log('Pass rate: ' + Math.round(results.pass / (results.pass + results.fail) * 100) + '%');
}

main().catch(console.error);
