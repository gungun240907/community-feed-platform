const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const FIREBASE_EMULATOR = process.env.FIREBASE_EMULATOR === 'true';

const IDENTITYKIT_BASE = FIREBASE_EMULATOR
  ? 'http://127.0.0.1:9099/identitytoolkit.googleapis.com'
  : 'https://identitytoolkit.googleapis.com';

function isFirebaseConfigured() {
  return !!FIREBASE_API_KEY;
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
    throw error;
  }

  let res;
  try {
    res = await fetch(
      `${IDENTITYKIT_BASE}/v1/accounts:signInWithPhoneNumber?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionInfo: verificationId,
          code,
          phoneNumber,
        }),
      }
    );
  } catch (error) {
    const e = new Error('Phone verification service is unreachable. Please try again.');
    e.statusCode = 502;
    throw e;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data?.error?.message || 'Phone verification failed';
    if (
      message.includes('INVALID_SESSION_INFO') ||
      message.includes('INVALID_CODE') ||
      message.includes('MISMATCH')
    ) {
      const e = new Error('Invalid OTP. Please try again.');
      e.statusCode = 400;
      throw e;
    }
    if (message.includes('SESSION_EXPIRED') || message.includes('EXPIRED')) {
      const e = new Error('OTP expired. Please request a new one.');
      e.statusCode = 400;
      throw e;
    }
    const e = new Error(message);
    e.statusCode = 502;
    throw e;
  }

  return { phoneNumber: data.phoneNumber, idToken: data.idToken };
}

module.exports = { isFirebaseConfigured, verifyPhoneCode, maskPhone };
