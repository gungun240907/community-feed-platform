/**
 * SMS delivery via MSG91.
 *
 * Uses the modern MSG91 V5 Flow API when a flow is configured, otherwise
 * falls back to the classic send-OTP / send-SMS endpoints. All credentials
 * come from environment variables and are never exposed to the client.
 *
 * Required:
 *   MSG91_AUTH_KEY
 * Optional:
 *   MSG91_SENDER_ID          (default DEVFEED)
 *   MSG91_FLOW_ID            (transactional OTP flow template id)
 *   MSG91_FLOW_VARIABLE      (template variable that receives the OTP, default OTP)
 *   MSG91_ROUTE              (1 = promotional, 4 = transactional, default 4)
 *   MSG91_BASE_URL           (default https://control.msg91.com)
 */

const BASE_URL = process.env.MSG91_BASE_URL || 'https://control.msg91.com';

function isSmsConfigured() {
  return !!process.env.MSG91_AUTH_KEY;
}

/** Normalize an international phone number to digits with country code. */
function normalizePhone(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  return digits || null;
}

/**
 * Generic SMS send via the classic endpoint.
 * @param {string} to  E.164 style number (digits, country code included)
 * @param {string} body
 * @returns {Promise<boolean>}
 */
async function sendSms(to, body) {
  const authKey = process.env.MSG91_AUTH_KEY;
  if (!authKey) {
    console.log('[smsService] MSG91 not configured; skipping SMS.');
    return false;
  }

  const mobile = normalizePhone(to);
  if (!mobile) return false;

  const params = new URLSearchParams({
    authkey: authKey,
    mobiles: mobile,
    message: body,
    sender: process.env.MSG91_SENDER_ID || 'DEVFEED',
    route: process.env.MSG91_ROUTE || '4',
    country: '91',
  });
  if (process.env.MSG91_PASSWORD) params.set('password', process.env.MSG91_PASSWORD);

  try {
    const res = await fetch(`${BASE_URL}/api/sendhttp.php?${params.toString()}`, { method: 'GET' });
    const text = await res.text();
    // MSG91 returns the plain text "error:..." or a success message/code.
    const ok = res.ok && /^error:/i.test(text) === false;
    if (ok) {
      console.log(`[smsService] SMS sent to ${mobile}`);
      return true;
    }
    console.error(`[smsService] MSG91 sendhttp failed: ${text.slice(0, 200)}`);
    return false;
  } catch (err) {
    console.error('[smsService] SMS send threw:', err.message);
    return false;
  }
}

/**
 * Send an OTP via MSG91.
 * Prefers the V5 Flow API (transactional template); falls back to the
 * dedicated send-OTP endpoint. The plaintext OTP is only placed inside the
 * outbound message payload — it is never logged.
 * @param {object} user
 * @param {string} otp
 * @param {string} purpose
 * @returns {Promise<boolean>}
 */
async function sendOtpSms(user, otp, purpose) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const mobile = normalizePhone(user.phone);
  if (!authKey || !mobile) return false;

  const purposeLabel = purpose === 'language_switch' ? 'language change' : 'verification';
  const message = `Your DevFeed ${purposeLabel} code is ${otp}. It expires in 5 minutes.`;

  // Modern flow-based delivery (recommended): template variable receives the OTP.
  const flowId = process.env.MSG91_FLOW_ID;
  if (flowId) {
    const variable = process.env.MSG91_FLOW_VARIABLE || 'OTP';
    try {
      const res = await fetch(`${BASE_URL}/api/v5/flow/`, {
        method: 'POST',
        headers: {
          authkey: authKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: process.env.MSG91_SENDER_ID || 'DEVFEED',
          flow_id: flowId,
          recipients: [{ mobiles: mobile, [variable]: otp }],
        }),
      });
      const data = await res.json().catch(() => null);
      const ok = res.ok && data && (data.type === 'success' || data.message === 'success');
      if (ok) {
        console.log(`[smsService] OTP SMS sent to ${mobile}`);
        return true;
      }
      console.error(`[smsService] MSG91 flow failed: ${JSON.stringify(data || (await res.text().catch(() => ''))).slice(0, 200)}`);
      return false;
    } catch (err) {
      console.error('[smsService] MSG91 flow threw:', err.message);
      return false;
    }
  }

  // Legacy fallback: send with the OTP embedded.
  const params = new URLSearchParams({
    authkey: authKey,
    mobile,
    message,
    sender: process.env.MSG91_SENDER_ID || 'DEVFEED',
    otp,
    otp_expiry: process.env.OTP_EXPIRY_MINUTES || '5',
    otp_length: '6',
  });

  try {
    const res = await fetch(`${BASE_URL}/api/sendotp.php?${params.toString()}`, { method: 'GET' });
    const text = await res.text();
    const ok = res.ok && !/^error:/i.test(text);
    if (ok) {
      console.log(`[smsService] OTP SMS sent to ${mobile}`);
      return true;
    }
    console.error(`[smsService] MSG91 sendotp failed: ${text.slice(0, 200)}`);
    return false;
  } catch (err) {
    console.error('[smsService] MSG91 sendotp threw:', err.message);
    return false;
  }
}

async function sendPasswordResetSms(user, newPassword) {
  if (!user.phone) return false;
  return sendSms(
    user.phone,
    'Your DevFeed password has been reset. Use the new password from the email to sign in, then change it from your profile.'
  );
}

module.exports = { isSmsConfigured, sendSms, sendOtpSms, sendPasswordResetSms };
