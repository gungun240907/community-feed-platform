const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

// Configure the service with fake-but-valid-looking credentials so getConfig()
// reports `configured: true` (no placeholder prefixes, no spaces).
process.env.WHATSAPP_ACCESS_TOKEN = 'EAABfakeTokenForTest';
process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
process.env.WHATSAPP_API_VERSION = 'v21.0';
process.env.WHATSAPP_OTP_TEMPLATE = 'otp';
process.env.WHATSAPP_RESET_TEMPLATE = 'password_reset';

const axios = require('axios');
const whatsappService = require('../src/server/utils/whatsappService');

// Capture the last payload POSTed to the Graph API without making a real call.
let lastPayload = null;
let lastUrl = null;
axios.post = async (url, payload, opts) => {
  lastUrl = url;
  lastPayload = payload;
  return { data: { messages: [{ id: 'wamid.TEST' }] } };
};

beforeEach(() => {
  lastPayload = null;
  lastUrl = null;
});

test('whatsapp is reported configured with valid env', () => {
  assert.strictEqual(whatsappService.isConfigured(), true);
});

test('sendOtp uses an Authentication (button/otp) template payload', async () => {
  const ok = await whatsappService.sendOtp('+15551234567', '123456');
  assert.strictEqual(ok, true);
  assert.ok(lastPayload, 'no payload was sent');
  assert.strictEqual(lastPayload.messaging_product, 'whatsapp');
  assert.strictEqual(lastPayload.recipient_type, 'individual');
  assert.strictEqual(lastPayload.to, '+15551234567');
  assert.strictEqual(lastPayload.type, 'template');
  assert.strictEqual(lastPayload.template.name, 'otp');
  assert.strictEqual(lastPayload.template.language.code, 'en');

  const components = lastPayload.template.components;
  assert.strictEqual(components.length, 1);
  assert.strictEqual(components[0].type, 'button');
  assert.strictEqual(components[0].sub_type, 'otp');
  assert.strictEqual(components[0].parameters[0].type, 'text');
  assert.strictEqual(components[0].parameters[0].text, '123456');

  // The code must NOT be smuggled in as a body parameter for auth templates.
  const hasBodyComponent = components.some((c) => c.type === 'body');
  assert.strictEqual(hasBodyComponent, false);
});

test('sendPasswordReset uses a Utility (body) template payload', async () => {
  const ok = await whatsappService.sendPasswordReset('+15551234567', 'NewPass!23');
  assert.strictEqual(ok, true);
  assert.ok(lastPayload, 'no payload was sent');
  assert.strictEqual(lastPayload.template.name, 'password_reset');

  const components = lastPayload.template.components;
  assert.strictEqual(components.length, 1);
  assert.strictEqual(components[0].type, 'body');
  assert.strictEqual(components[0].parameters[0].type, 'text');
  assert.strictEqual(components[0].parameters[0].text, 'NewPass!23');

  const hasOtpButton = components.some((c) => c.type === 'button' && c.sub_type === 'otp');
  assert.strictEqual(hasOtpButton, false);
});

test('invalid phone numbers are rejected without sending', async () => {
  const ok = await whatsappService.sendOtp('not-a-phone', '123456');
  assert.strictEqual(ok, false);
  assert.strictEqual(lastPayload, null);
});
