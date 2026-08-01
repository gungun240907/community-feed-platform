process.env.MONGO_URI = '';
process.env.NODE_ENV = 'production';
process.env.ALLOW_DEV_ACTIVATE = 'true';
process.env.JWT_SECRET = 'child-secret';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.RAZORPAY_KEY_ID = '';
process.env.RAZORPAY_KEY_SECRET = '';
delete process.env.RAZORPAY_WEBHOOK_SECRET;
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_FROM_NUMBER;

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
  await User.create({ username: 'childadmin', email: 'childadmin@test.com', password: 'Child123!', role: 'admin' });

  const loginRes = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'gating-test' },
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
