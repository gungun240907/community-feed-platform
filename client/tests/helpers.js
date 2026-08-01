const nodemailer = require('nodemailer');

process.env.MONGO_URI = '';
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.ALLOW_DEV_ACTIVATE = 'true';
process.env.RAZORPAY_KEY_ID = '';
process.env.RAZORPAY_KEY_SECRET = 'test-signing-secret';
delete process.env.RAZORPAY_WEBHOOK_SECRET;
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_FROM_NUMBER;

const UA_A = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const UA_B = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/119.0';

async function waitFor(fn, timeoutMs = 60000, intervalMs = 200) {
  const start = Date.now();
  for (;;) {
    const ok = await fn();
    if (ok) return true;
    if (Date.now() - start > timeoutMs) return false;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function boot() {
  const account = await nodemailer.createTestAccount();
  process.env.SMTP_HOST = account.smtp.host;
  process.env.SMTP_PORT = String(account.smtp.port);
  process.env.SMTP_SECURE = account.smtp.secure ? 'true' : 'false';
  process.env.SMTP_USER = account.user;
  process.env.SMTP_PASS = account.pass;
  process.env.SMTP_FROM = 'noreply@devfeed.com';

  const app = require('../src/server/app');
  const mongoose = require('mongoose');

  const dbReady = await waitFor(() => mongoose.connection.readyState === 1);
  if (!dbReady) throw new Error('In-memory MongoDB did not become ready');

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const healthy = await waitFor(async () => {
    try {
      const r = await fetch(base + '/api/health');
      return r.ok;
    } catch { return false; }
  }, 30000, 200);
  if (!healthy) throw new Error('Server /api/health never responded');

  return {
    base,
    port: server.address().port,
    ethereal: {
      url: 'https://ethereal.email',
      user: account.user,
      pass: account.pass,
    },
    mongoose,
    db: mongoose.connection,
    close: async () => {
      try {
        if (mongoose.connection.readyState === 1) {
          await mongoose.connection.db.admin().command({ shutdown: 1 });
        }
      } catch { /* mongod already gone */ }
      try { await mongoose.disconnect(); } catch { /* already closed */ }
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

async function api(base, method, path, { token, body, headers, rawBody, ua } = {}) {
  const h = { 'User-Agent': ua || UA_A, ...(headers || {}) };
  if (token) h['Authorization'] = 'Bearer ' + token;
  let bodyStr;
  if (rawBody !== undefined) {
    bodyStr = rawBody;
    h['Content-Type'] = 'application/json';
  } else if (body !== undefined) {
    bodyStr = JSON.stringify(body);
    h['Content-Type'] = 'application/json';
  }
  const res = await fetch(base + path, { method, headers: h, body: bodyStr });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data, headers: res.headers, text };
}

module.exports = { boot, api, UA_A, UA_B, waitFor };
