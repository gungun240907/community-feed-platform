const assert = require('assert');
const axios = require('axios');

// Mock axios so no real network calls happen.
let lastRequest = null;
const postMock = async (url, body, opts) => {
  lastRequest = { method: 'post', url, body, opts };
  // send -> returns a verificationId
  return { data: { status: 'SUCCESS', data: { verificationId: 'vid-123', mobileNumber: '9876543210' } } };
};
const getMock = async (url, opts) => {
  lastRequest = { method: 'get', url, opts };
  // validate -> returns completed status
  if (url.includes('validateOtp')) return { data: { status: 'SUCCESS', data: { verificationStatus: 'VERIFICATION_COMPLETED' } } };
  // token
  return { data: { token: 'test-token' } };
};
axios.post = postMock;
axios.get = getMock;

const mc = require('../src/server/utils/messageCentralService');
const { normalizePhone } = require('../src/server/utils/phone');

async function run() {
  // Simulate "no config" by clearing any creds loaded from .env.
  delete process.env.MC_CUSTOMER_ID;
  delete process.env.MC_EMAIL;
  delete process.env.MC_PASSWORD;
  delete process.env.MC_AUTH_TOKEN;
  delete process.env.MC_API_KEY;
  assert.strictEqual(mc.isConfigured(), false, 'should be unconfigured without env');

  // With creds, token + send should be attempted and succeed.
  process.env.MC_CUSTOMER_ID = 'C123';
  process.env.MC_EMAIL = 'test@x.com';
  process.env.MC_PASSWORD = 'secret';
  assert.strictEqual(mc.isConfigured(), true, 'should be configured with creds');

  const vid = await mc.sendOtp({ user: { phone: '+919876543210' }, channel: 'SMS' });
  assert.ok(vid, 'sendOtp should return a verificationId');
  assert.strictEqual(lastRequest.method, 'post');
  assert.ok(lastRequest.url.includes('/verification/v3/send'), 'uses v3 send endpoint');
  const params = lastRequest.opts.params;
  assert.strictEqual(params.flowType, 'SMS');
  assert.strictEqual(params.countryCode, '91');
  assert.strictEqual(params.mobileNumber, '9876543210');
  assert.strictEqual(params.message, undefined, 'no custom message (provider generates code)');
  assert.strictEqual(lastRequest.opts.headers.authToken, 'test-token', 'auth token header set');

  // Invalid phone should fail gracefully.
  const bad = await mc.sendOtp({ user: { phone: 'not-a-phone' }, channel: 'SMS' });
  assert.strictEqual(bad, null, 'invalid phone should not send');

  // WhatsApp channel maps to flowType=WHATSAPP.
  await mc.sendOtp({ user: { phone: '+919876543210' }, channel: 'WHATSAPP' });
  assert.strictEqual(lastRequest.opts.params.flowType, 'WHATSAPP');

  // validateOtp returns true on VERIFICATION_COMPLETED.
  const ok = await mc.validateOtp({ verificationId: 'vid-123', code: '654321', channel: 'SMS' });
  assert.strictEqual(ok, true, 'validateOtp should return true on completed status');
  assert.ok(lastRequest.url.includes('/verification/v3/validateOtp'), 'uses v3 validate endpoint');

  // validateOtp returns false on a failed status.
  axios.get = async () => ({ data: { status: 'FAILURE', data: { verificationStatus: 'VERIFICATION_FAILED' } } });
  const bad2 = await mc.validateOtp({ verificationId: 'vid-123', code: '000000', channel: 'SMS' });
  assert.strictEqual(bad2, false, 'validateOtp should return false on failed status');

  console.log('messageCentralService tests passed');
}

run().catch((e) => {
  console.error('messageCentralService tests failed:', e);
  process.exit(1);
});
