/**
 * Manual live-delivery test for the OTP transport.
 *
 * Triggers a real OTP send through Message Central to a phone number you
 * provide, so you can confirm SMS/WhatsApp delivery works end-to-end without
 * triggering a full language-switch flow. Uses the SAME code path as production
 * (messageCentralService). NOTE: Message Central generates the code itself, so
 * the code that arrives on the device is NOT shown here.
 *
 * Usage:
 *   node scripts/testOtpDelivery.js <phone> [SMS|WHATSAPP]
 *   node scripts/testOtpDelivery.js +919876543210 SMS
 *
 * Or set env: TEST_PHONE=+919876543210 TEST_CHANNEL=SMS
 *
 * Requires MC_* creds in .env (MC_AUTH_TOKEN recommended).
 */
require('dotenv').config();
const mc = require('../src/server/utils/messageCentralService');
const { normalizePhone } = require('../src/server/utils/phone');

async function main() {
  const phone = process.argv[2] || process.env.TEST_PHONE;
  const channel = (process.argv[3] || process.env.TEST_CHANNEL || 'SMS').toUpperCase();

  if (!phone) {
    console.error('Missing phone number. Usage: node scripts/testOtpDelivery.js <phone> [SMS|WHATSAPP]');
    process.exit(2);
  }

  const e164 = normalizePhone(phone);
  if (!e164) {
    console.error(`Invalid phone number: ${phone}`);
    process.exit(2);
  }

  if (!mc.isConfigured()) {
    console.error('Message Central is NOT configured. Set MC_AUTH_TOKEN (or MC_CUSTOMER_ID/MC_EMAIL/MC_PASSWORD) in .env.');
    process.exit(3);
  }

  console.log(`Requesting a Message Central OTP for ${e164} via ${channel} ...`);

  try {
    const verificationId = await mc.sendOtp({ user: { phone: e164 }, channel });
    if (verificationId) {
      console.log(`SUCCESS: OTP delivered to ${e164} via ${channel} (verificationId ${verificationId}). Check the device for the code.`);
      process.exit(0);
    } else {
      console.error(`FAILED: Message Central reported failure for ${channel}. See server logs above.`);
      process.exit(1);
    }
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

main();
