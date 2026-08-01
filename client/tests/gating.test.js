const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('path');

test('production gating: dev-activate blocked, forgot-password 503 without SMTP', { timeout: 180000 }, () => {
  const res = spawnSync(process.execPath, [path.join(__dirname, 'gating_child.js')], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    timeout: 180000,
    env: { ...process.env },
  });

  assert.strictEqual(res.status, 0, `child exited ${res.status}: ${(res.stdout || '')} ${(res.stderr || '')}`);
  const lines = res.stdout.trim().split('\n').filter(Boolean);
  const out = JSON.parse(lines[lines.length - 1]);

  assert.strictEqual(out.devActivate, 404, 'dev-activate must be disabled when NODE_ENV=production');
  assert.strictEqual(out.forgotPassword, 503, 'forgot-password must return 503 when email/SMS delivery is unconfigured');
});
