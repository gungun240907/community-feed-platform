process.env.MONGO_URI = '';
process.env.NODE_ENV = 'production';
process.env.ALLOW_DEV_ACTIVATE = 'true';
process.env.ALLOW_IN_MEMORY_DB = 'true';
process.env.JWT_SECRET = 'child-secret-0123456789abcdefghijklmnopqrstuvwxyz';
process.env.OTP_PEPPER_SECRET = 'child-otp-pepper-0123456789';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.RAZORPAY_KEY_ID = '';
process.env.RAZORPAY_KEY_SECRET = '';
delete process.env.RAZORPAY_WEBHOOK_SECRET;
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';

async function main() {
  const app = require('../src/server/app');
  const mongoose = require('mongoose');

  for (let i = 0; i < 300; i++) {
    if (mongoose.connection.readyState === 1) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  if (mongoose.connection.readyState !== 1) throw new Error('DB not ready in child');

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  await User.deleteMany({});
  const childUser = await User.create({ username: 'childadmin', email: 'childadmin@test.com', password: 'Child123!', role: 'admin' });

  // Simulate a recognized (trusted) device so the production login returns a
  // session token directly without triggering the new-device OTP challenge
  // (which cannot be completed here because SMTP is unconfigured in this test).
  const crypto = require('crypto');
  const { generateDeviceFingerprint } = require('../src/server/utils/userAgentParser');
  const UA = 'gating-test';
  const fingerprint = generateDeviceFingerprint(UA, '127.0.0.1', '');
  await mongoose.model('Session').create({
    user: childUser._id,
    sessionId: crypto.randomBytes(24).toString('hex'),
    browser: '',
    os: '',
    deviceType: 'unknown',
    deviceFingerprint: fingerprint,
    ip: '127.0.0.1',
    location: {},
    lastActiveAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    isTrusted: true,
    loginMethod: 'password',
  });

  const loginRes = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ login: 'childadmin', password: 'Child123!' }),
  });
  const loginJson = await loginRes.json();
  const token = loginJson.token;

  const devAct = await fetch(base + '/api/subscriptions/dev-activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ plan: 'bronze' }),
  });

  const forgot = await fetch(base + '/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'childadmin@test.com' }),
  });

  console.log(JSON.stringify({ devActivate: devAct.status, forgotPassword: forgot.status }));
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('CHILD ERROR:', e);
  process.exit(1);
});
