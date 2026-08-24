/**
 * Standalone helper to verify WhatsApp OTP delivery end-to-end.
 *
 * Usage (from the client/ directory):
 *   node scripts/verify-whatsapp.js <phoneNumber> [code]
 *
 * Example:
 *   node scripts/verify-whatsapp.js +919999999999
 *   node scripts/verify-whatsapp.js +919999999999 123456
 *
 * It loads .env (via dotenv), checks the WhatsApp config, normalizes the
 * phone number, and sends a single test OTP using the configured `otp`
 * template. Requires WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID
 * to be set in .env (see .env.example).
 */
require('dotenv').config();

const { isConfigured, sendOtp, getConfig } = require('../src/server/utils/whatsappService');
const { normalizePhone } = require('../src/server/utils/phone');

function usage() {
  console.log('Usage: node scripts/verify-whatsapp.js <phoneNumber> [code]');
  console.log('  <phoneNumber>  E.164 phone, e.g. +919999999999');
  console.log('  [code]         optional 6-digit code (random if omitted)');
}

async function main() {
  const [phone, codeArg] = process.argv.slice(2);
  if (!phone) {
    usage();
    process.exit(1);
  }

  const cfg = getConfig();
  console.log('WhatsApp config:');
  console.log('  WHATSAPP_PHONE_NUMBER_ID :', cfg.phoneNumberId || '(missing)');
  console.log('  WHATSAPP_ACCESS_TOKEN    :', cfg.accessToken ? '**** set' : '(missing)');
  console.log('  WHATSAPP_API_VERSION     :', cfg.apiVersion);
  console.log('  WHATSAPP_OTP_TEMPLATE    :', cfg.otpTemplate);

  if (!isConfigured()) {
    console.error('\n✗ WhatsApp is NOT configured. Set WHATSAPP_ACCESS_TOKEN and');
    console.error('  WHATSAPP_PHONE_NUMBER_ID in .env, then retry.');
    process.exit(2);
  }

  const normalized = normalizePhone(phone);
  if (!normalized) {
    console.error(`\n✗ Could not normalize phone "${phone}" to E.164.`);
    process.exit(3);
  }
  console.log('\nNormalized phone:', normalized);

  const code = codeArg && /^\d{4,9}$/.test(codeArg) ? codeArg : String(Math.floor(100000 + Math.random() * 900000));
  console.log('Sending OTP code:', code, `via template "${cfg.otpTemplate}"...`);

  const delivered = await sendOtp(normalized, code);
  if (delivered) {
    console.log('\n✓ Message accepted by Meta. Check the WhatsApp number', normalized, 'for the code.');
    process.exit(0);
  } else {
    console.error('\n✗ Meta rejected the message or the request failed. See logs above.');
    process.exit(4);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err && err.message ? err.message : err);
  process.exit(5);
});
