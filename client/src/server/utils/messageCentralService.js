require('dotenv').config();
const axios = require('axios');
const { normalizePhone } = require('./phone');

/**
 * Message Central (VerifyNow) OTP transport + verification.
 *
 * IMPORTANT — provider-managed OTP:
 * Message Central's working endpoint generates and verifies the OTP itself;
 * it does NOT allow us to inject our own code (the custom-message / transport
 * mode is discontinued on this account). So for the phone channel we use the
 * provider's flow end-to-end:
 *   - sendOtp()  -> POST /verification/v3/send  -> returns a verificationId
 *   - validateOtp() -> POST /verification/v3/validateOtp -> bool
 * The returned verificationId is persisted on the Otp document and used to
 * verify the user's input. Email OTP remains fully local (hashed + verified
 * by DevFeed). All other DevFeed safeguards (resend cooldown, attempt cap,
 * TTL, atomic one-time consumption, app-level rate limiting) are unchanged.
 *
 * Docs: base https://cpaas.messagecentral.com
 *   Token:  GET  /auth/v1/authentication/token
 *   Send:   POST /verification/v3/send
 *   Verify: GET  /verification/v3/validateOtp
 */

const BASE = (process.env.MC_API_BASE || 'https://cpaas.messagecentral.com').replace(/\/$/, '');

let cachedToken = null;
let tokenExpiry = 0;

function isConfigured() {
  return Boolean(
    (process.env.MC_CUSTOMER_ID && process.env.MC_EMAIL && process.env.MC_PASSWORD) ||
      process.env.MC_AUTH_TOKEN
  );
}

async function getToken() {
  if (process.env.MC_AUTH_TOKEN) return process.env.MC_AUTH_TOKEN;

  const now = Date.now();
  if (cachedToken && now < tokenExpiry) return cachedToken;

  const customerId = process.env.MC_CUSTOMER_ID;
  const email = process.env.MC_EMAIL;
  const key = Buffer.from(process.env.MC_PASSWORD || '').toString('base64');
  const country = process.env.MC_COUNTRY || '91';

  const { data } = await axios.get(`${BASE}/auth/v1/authentication/token`, {
    params: { customerId, key, scope: 'NEW', country, email },
  });

  const token = data && data.token ? data.token : data;
  if (!token) throw new Error('Message Central token response missing token');
  cachedToken = token;
  tokenExpiry = now + 23 * 60 * 60 * 1000; // refresh before the ~24h TTL
  return token;
}

// Split an E.164 number into Message Central's countryCode + mobileNumber.
function splitPhone(e164) {
  const digits = e164.replace(/\D/g, '');
  if (digits.length > 10) {
    return {
      countryCode: digits.slice(0, digits.length - 10),
      mobileNumber: digits.slice(-10),
    };
  }
  return { countryCode: process.env.MC_COUNTRY || '91', mobileNumber: digits };
}

/**
 * Request an OTP from Message Central. The provider generates the code and
 * delivers it via SMS/WhatsApp. Returns the verificationId (truthy) on success.
 */
async function sendOtp({ user, channel = 'SMS' }) {
  if (!isConfigured()) return null;
  if (!user || !user.phone) {
    console.warn('[messageCentral] No phone number; cannot send OTP.');
    return null;
  }

  const e164 = normalizePhone(user.phone);
  if (!e164) {
    console.warn('[messageCentral] Invalid phone number; cannot send OTP.');
    return null;
  }

  const { countryCode, mobileNumber } = splitPhone(e164);
  const flowType = channel === 'WHATSAPP' ? 'WHATSAPP' : 'SMS';

  // NOTE: do NOT pass a `message`/`type` param — that triggers the discontinued
  // "Old MessageNow/VerifyNow-WA" path. Plain send lets the provider generate
  // and deliver the code.
  const params = {
    countryCode,
    flowType,
    mobileNumber,
    otpLength: parseInt(process.env.OTP_LENGTH || '6', 10),
  };

  let authToken;
  try {
    authToken = await getToken();
  } catch (err) {
    console.error('[messageCentral] Token fetch failed:', err.message);
    return null;
  }

  try {
    const { data } = await axios.post(`${BASE}/verification/v3/send`, null, {
      params,
      headers: { authToken, accept: '*/*' },
      timeout: 10000,
    });

    const data_ = data && data.data ? data.data : data;
    const verificationId =
      (data_ && (data_.verificationId || data_.verification_id)) ||
      (data && (data.verificationId || data.verification_id));

    if (!verificationId) {
      console.error('[messageCentral] Send succeeded but no verificationId:', JSON.stringify(data));
      return null;
    }
    return String(verificationId);
  } catch (err) {
    const resp = err.response?.data;
    // MC enforces a ~60s per-number resend cooldown. When a verification is
    // already pending it returns 506 REQUEST_ALREADY_EXISTS *with* a valid
    // verificationId — reuse it so the user can still verify with the code
    // already delivered, instead of falling back to email and orphaning it.
    const pendingId =
      resp &&
      (resp.data?.verificationId || resp.verificationId ||
        resp.data?.verification_id || resp.verification_id);
    if (pendingId && (resp.responseCode === 506 || resp.responseCode === '506' ||
        /REQUEST_ALREADY_EXISTS/i.test(resp.message || '') ||
        /already exists/i.test(JSON.stringify(resp)))) {
      console.warn('[messageCentral] Reusing existing pending verification:', pendingId);
      return String(pendingId);
    }
    console.error('[messageCentral] Send failed:', resp || err.message);
    return null;
  }
}

/**
 * Verify a user-entered code against Message Central's verificationId.
 * Returns true on success.
 */
async function validateOtp({ verificationId, code, channel = 'SMS' }) {
  if (!verificationId || !code) return false;
  let authToken;
  try {
    authToken = await getToken();
  } catch (err) {
    console.error('[messageCentral] Token fetch failed:', err.message);
    return false;
  }

  const flowType = channel === 'WHATSAPP' ? 'WHATSAPP' : 'SMS';
  try {
    const { data } = await axios.get(`${BASE}/verification/v3/validateOtp`, {
      params: { verificationId, code, flowType },
      headers: { authToken, accept: '*/*' },
      timeout: 10000,
    });
    const status =
      (data && data.data && data.data.verificationStatus) ||
      (data && data.verificationStatus) ||
      data?.status;
    return Boolean(
      status === 'VERIFICATION_COMPLETED' || status === 'VERIFIED' || status === 'SUCCESS'
    );
  } catch (err) {
    console.error('[messageCentral] Validate failed:', err.response?.data || err.message);
    return false;
  }
}

module.exports = { isConfigured, sendOtp, validateOtp, getToken };
