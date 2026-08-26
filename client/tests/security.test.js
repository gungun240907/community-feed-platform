const { test } = require('node:test');
const assert = require('node:assert');
const { getClientIp } = require('../src/server/middleware/auth');

// D10: getClientIp must only trust X-Forwarded-For when the app is explicitly
// run behind a trusted proxy. Otherwise an attacker could spoof the header to
// rotate their rate-limit key and evade login/OTP brute-force protection.
test('getClientIp ignores X-Forwarded-For unless trust proxy is set', () => {
  const fakeApp = (trusted) => ({ get: (k) => (k === 'trust proxy' ? trusted : undefined) });

  const spoofed = {
    headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    socket: { remoteAddress: '127.0.0.1' },
    app: fakeApp(false),
  };
  assert.strictEqual(
    getClientIp(spoofed),
    '127.0.0.1',
    'must ignore XFF (use socket IP) when proxy is not trusted'
  );

  const trusted = {
    headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    socket: { remoteAddress: '127.0.0.1' },
    app: fakeApp(true),
  };
  assert.strictEqual(
    getClientIp(trusted),
    '1.2.3.4',
    'must honor the leftmost XFF value when proxy is trusted'
  );
});

test('getClientIp falls back to socket/req.ip when no header', () => {
  const req = { headers: {}, socket: { remoteAddress: '::1' }, app: { get: () => false } };
  assert.strictEqual(getClientIp(req), '::1');
});
