/**
 * Server-side Firebase Phone Auth verification (REST).
 *
 * Language-switch SMS OTPs are sent by the browser through the Firebase SDK
 * (free SMS via Google), so the plaintext code never touches our server or
 * database. The server only receives the { verificationId, code } pair and
 * exchanges it with Firebase's Identity Toolkit `signInWithPhoneNumber`
 * endpoint, keyed with the public web API key (FIREBASE_API_KEY). It then
 * asserts that the phone number on the verified session matches the one stored
 * on the user's profile, so one user's session can never switch another's.
 *
 * Emulator mode (FIREBASE_EMULATOR === 'true') points requests at a local auth
 * emulator for development; production always uses the public endpoint. Env is
 * read lazily so the app can boot (and test) without credentials configured.
 */

const IDENTITYKIT_BASE = 'https://identitytoolkit.googleapis.com';
const EMULATOR_BASE = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com';

let verifierOverride = null;

function isFirebaseConfigured() {
  return !!process.env.FIREBASE_API_KEY;
}

function maskPhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  const prefix = phone.startsWith('+') ? '+' : '';
  return `${prefix}****${phone.slice(-4)}`;
}

async function verifyPhoneCode({ verificationId, code, phoneNumber }) {
  if (!isFirebaseConfigured()) {
    const error = new Error(
      'Phone verification is not configured. Please ask an administrator to set up Firebase.'
    );
    error.statusCode = 503;
    error.code = 'FIREBASE_NOT_CONFIGURED';
    throw error;
  }

  if (verifierOverride) {
    return verifierOverride({ verificationId, code, phoneNumber });
  }

  const base = process.env.FIREBASE_EMULATOR === 'true' ? EMULATOR_BASE : IDENTITYKIT_BASE;

  let res;
  try {
    res = await fetch(
      `${base}/v1/accounts:signInWithPhoneNumber?key=${process.env.FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionInfo: verificationId, code, phoneNumber }),
      }
    );
  } catch {
    const error = new Error('Phone verification service is unreachable. Please try again.');
    error.statusCode = 502;
    throw error;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data?.error?.message || 'Phone verification failed';
    if (
      message.includes('INVALID_SESSION_INFO') ||
      message.includes('INVALID_CODE') ||
      message.includes('MISMATCH')
    ) {
      const error = new Error('Invalid OTP. Please try again.');
      error.statusCode = 400;
      throw error;
    }
    if (message.includes('SESSION_EXPIRED') || message.includes('EXPIRED')) {
      const error = new Error('OTP expired. Please request a new one.');
      error.statusCode = 400;
      throw error;
    }
    const error = new Error(message);
    error.statusCode = 502;
    throw error;
  }

  return { phoneNumber: data.phoneNumber, idToken: data.idToken };
}

/**
 * Test-only hook so the phone-verification path can be exercised without a
 * real Firebase project. Pass null to restore the real implementation.
 * This is intentionally never wired to any route.
 */
function _setPhoneVerifier(fn) {
  verifierOverride = fn || null;
}

module.exports = { isFirebaseConfigured, verifyPhoneCode, maskPhone, _setPhoneVerifier };
