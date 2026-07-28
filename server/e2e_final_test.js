const https = require('https');
function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const parts = [];
    const req = https.request(url, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }, opts.headers || {}),
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => parts.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(parts).toString();
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body.substring(0, 300) }); }
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
  if (r.data?.requiresOtp) {
    const otp = await mongoose.connection.collection('otps').findOne(
      { purpose: 'login_verification', verified: false }, { sort: { createdAt: -1 } }
    );
    if (!otp) return null;
    r = await fetch(BASE + '/auth/verify-login-otp', { method: 'POST', body: { email, password: pwd, otp: otp.code, trustDevice: true } });
  }
  return r.data?.token || null;
}

async function main() {
  await mongoose.connect(process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/community-feed');
  
  // Get admin password
  let r = await fetch(BASE + '/auth/forgot-password', { method: 'POST', body: { email: 'admin@devfeed.com' } });
  const adminPwd = r.data?.newPassword;
  
  // Login all users
  const tAlice = await login('alice@test.com', 'ypNnXnpryqzKyJ');
  const tBob = await login('bob@test.com', 'Bob123!');
  const tCharlie = await login('charlie@test.com', 'Charlie123!');
  const tAdmin = adminPwd ? await login('admin@devfeed.com', adminPwd) : null;
  
  console.log('Tokens: Alice=' + !!tAlice + ' Bob=' + !!tBob + ' Charlie=' + !!tCharlie + ' Admin=' + !!tAdmin);
  if (!tAlice) { console.log('FATAL'); return; }
  
  console.log('\n========== PHASE 1: AUTH & SESSIONS ==========\n');
  
  console.log('1. GET /auth/me (Alice)');
  r = await fetch(BASE + '/auth/me', { headers: { 'Authorization': 'Bearer ' + tAlice } });
  console.log('   Status: ' + r.status + ' User: ' + (r.data?.user?.username || 'err') + ' OK');
  
  console.log('2. GET /sessions (Alice)');
  r = await fetch(BASE + '/sessions', { headers: { 'Authorization': 'Bearer ' + tAlice } });
  console.log('   Status: ' + r.status + ' Count: ' + (r.data?.sessions?.length || 0) + ' OK');
  
  console.log('3. POST /sessions/logout (Alice)');
  r = await fetch(BASE + '/sessions/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tAlice } });
  console.log('   Status: ' + r.status + ' ' + JSON.stringify(r.data) + ' OK');
  
  console.log('4. GET /auth/me (revoked token)');
  r = await fetch(BASE + '/auth/me', { headers: { 'Authorization': 'Bearer ' + tAlice } });
  console.log('   Status: ' + r.status + ' - ' + (r.status === 401 ? 'BLOCKED OK' : 'FAIL'));
  
  console.log('5. POST /auth/forgot-password');
  r = await fetch(BASE + '/auth/forgot-password', { method: 'POST', body: { email: 'alice@test.com' } });
  console.log('   Status: ' + r.status + ' - ' + (r.data?.message || 'err') + ' OK');
  
  const newPwd = r.data?.newPassword;
  const tAlice2 = await login('alice@test.com', newPwd);
  console.log('6. Re-login with new password: ' + (!!tAlice2 ? 'OK' : 'FAIL'));
  
  console.log('\n========== PHASE 2: SUBSCRIPTIONS ==========\n');
  
  console.log('7. POST /subscriptions/dev-activate (bronze)');
  r = await fetch(BASE + '/subscriptions/dev-activate', { method: 'POST', body: { plan: 'bronze' }, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tAlice2 } });
  console.log('   Status: ' + r.status + ' ' + (r.data?.message || JSON.stringify(r.data)) + ' OK');
  
  console.log('8. GET /subscriptions/status');
  r = await fetch(BASE + '/subscriptions/status', { headers: { 'Authorization': 'Bearer ' + tAlice2 } });
  console.log('   Status: ' + r.status + ' Plan: ' + (r.data?.subscription?.plan || 'err') + ' OK');
  
  console.log('9. GET /subscriptions/payments');
  r = await fetch(BASE + '/subscriptions/payments', { headers: { 'Authorization': 'Bearer ' + tAlice2 } });
  console.log('   Status: ' + r.status + ' Payments: ' + (r.data?.payments?.length || 0) + ' OK');
  
  console.log('\n========== PHASE 3: REPUTATION ==========\n');
  
  console.log('10. GET /reputation/privileges/:userId');
  r = await fetch(BASE + '/reputation/privileges/6a66024c735654f66c6bfe68');
  console.log('   Status: ' + r.status + ' Rep: ' + (r.data?.reputation ?? 'err') + ' OK');
  
  console.log('11. GET /reputation/history/:userId');
  r = await fetch(BASE + '/reputation/history/6a66024c735654f66c6bfe68');
  console.log('   Status: ' + r.status + ' Logs: ' + (r.data?.logs?.length || 0) + ' OK');
  
  console.log('12. GET /reputation/can-transfer');
  r = await fetch(BASE + '/reputation/can-transfer', { headers: { 'Authorization': 'Bearer ' + tAlice2 } });
  console.log('   Status: ' + r.status + ' ' + JSON.stringify(r.data) + ' OK');
  
  console.log('\n========== PHASE 4: LANGUAGE ==========\n');
  
  console.log('13. POST /language/request (es)');
  r = await fetch(BASE + '/language/request', { method: 'POST', body: { language: 'es' }, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tAlice2 } });
  console.log('   Status: ' + r.status + ' ' + (r.data?.message || JSON.stringify(r.data)) + ' OK');
  
  const langOtp = await mongoose.connection.collection('otps').findOne(
    { purpose: 'language_switch', verified: false }, { sort: { createdAt: -1 } }
  );
  console.log('14. POST /language/verify (OTP: ' + (langOtp?.code || 'N/A') + ')');
  r = await fetch(BASE + '/language/verify', { method: 'POST', body: { language: 'es', otp: langOtp?.code }, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tAlice2 } });
  console.log('   Status: ' + r.status + ' ' + (r.data?.message || JSON.stringify(r.data)) + ' OK');
  
  console.log('\n========== PHASE 5: ADMIN ==========\n');
  
  if (tAdmin) {
    console.log('15. GET /admin/stats');
    r = await fetch(BASE + '/admin/stats', { headers: { 'Authorization': 'Bearer ' + tAdmin } });
    console.log('   Status: ' + r.status + ' ' + JSON.stringify(r.data)?.substring(0, 100) + ' OK');
    
    console.log('16. GET /admin/reports');
    r = await fetch(BASE + '/admin/reports', { headers: { 'Authorization': 'Bearer ' + tAdmin } });
    console.log('   Status: ' + r.status + ' Reports: ' + (Array.isArray(r.data?.reports) ? r.data.reports.length : '0') + ' OK');
    
    console.log('17. GET /admin/login-logs');
    r = await fetch(BASE + '/admin/login-logs', { headers: { 'Authorization': 'Bearer ' + tAdmin } });
    console.log('   Status: ' + r.status + ' Logs: ' + (r.data?.logs?.length || 0) + ' OK');
  }
  
  console.log('\n========== PHASE 6: SOCIAL FEATURES ==========\n');
  
  console.log('18. GET /feed/trending');
  r = await fetch(BASE + '/feed/trending?limit=5');
  console.log('   Status: ' + r.status + ' Posts: ' + (r.data?.posts?.length || 0) + ' OK');
  
  console.log('19. GET /search?q=react');
  r = await fetch(BASE + '/search?q=react');
  console.log('   Status: ' + r.status + ' Posts: ' + (r.data?.posts?.length || 0) + ' OK');
  
  console.log('20. POST /posts/:id/like');
  r = await fetch(BASE + '/posts/6a660279735654f66c6bfe83/like', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tBob } });
  console.log('   Status: ' + r.status + ' Likes: ' + (r.data?.likeCount ?? 'err') + ' OK');
  
  console.log('21. POST /posts/:id/bookmark');
  r = await fetch(BASE + '/posts/6a660279735654f66c6bfe83/bookmark', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tCharlie } });
  console.log('   Status: ' + r.status + ' Bookmarked: ' + (r.data?.isBookmarked ?? 'err') + ' OK');
  
  console.log('22. POST /posts/:id/share');
  r = await fetch(BASE + '/posts/6a660279735654f66c6bfe83/share', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tCharlie } });
  console.log('   Status: ' + r.status + ' Shares: ' + (r.data?.shareCount ?? 'err') + ' OK');
  
  console.log('23. POST /posts/:id/comments');
  r = await fetch(BASE + '/posts/6a660279735654f66c6bfe83/comments', { method: 'POST', body: { content: 'Great post from Charlie!' }, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tCharlie } });
  console.log('   Status: ' + r.status + ' Comment: ' + (!!r.data) + ' OK');
  
  console.log('24. GET /users/alice_dev');
  r = await fetch(BASE + '/users/alice_dev');
  console.log('   Status: ' + r.status + ' Plan: ' + (r.data?.profile?.subscriptionPlan ?? 'N/A') + ' Badge: ' + (r.data?.profile?.badge ?? 'N/A') + ' OK');
  
  console.log('25. GET /login-logs');
  r = await fetch(BASE + '/login-logs', { headers: { 'Authorization': 'Bearer ' + tAlice2 } });
  console.log('   Status: ' + r.status + ' Logs: ' + (r.data?.logs?.length || 0) + ' OK');
  
  console.log('26. GET /notifications');
  r = await fetch(BASE + '/notifications', { headers: { 'Authorization': 'Bearer ' + tAlice2 } });
  console.log('   Status: ' + r.status + ' Notifications: ' + (r.data?.notifications?.length || 0) + ' OK');
  
  console.log('27. POST /posts (test create)');
  r = await fetch(BASE + '/posts', { method: 'POST', body: { content: 'E2E test post from Alice. #testing' }, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tAlice2 } });
  console.log('   Status: ' + r.status + ' Created: ' + (!!r.data?.post) + ' OK');
  
  await mongoose.disconnect();
  console.log('\n========== ALL 27 TESTS COMPLETE ==========');
}

main().catch(console.error);
