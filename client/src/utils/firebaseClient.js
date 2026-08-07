/**
 * Client-side Firebase initialization (browser only).
 *
 * Firebase is lazy-loaded so Next.js SSR never touches browser-only APIs and
 * the bundle only grows when phone auth is actually used. The public web-app
 * config keys (NEXT_PUBLIC_FIREBASE_*) are designed to be exposed in the
 * browser — they are NOT secrets. The Admin SDK service-account key used to
 * verify ID tokens lives only on the server.
 */

function isFirebaseConfigured() {
  if (typeof window === 'undefined') return false;
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

let firebaseAppPromise = null;

function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.');
  }

  if (!firebaseAppPromise) {
    firebaseAppPromise = import('firebase/app').then(({ initializeApp }) =>
      initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      })
    );
  }

  return firebaseAppPromise;
}

/**
 * Kick off phone sign-in: renders an invisible reCAPTCHA in `containerId` and
 * asks Firebase to send a real SMS OTP to `phoneNumber` (E.164, e.g. +919876543210).
 * @returns {Promise<object>} confirmationResult used later by confirmPhoneOtp.
 */
async function sendPhoneOtp(phoneNumber, containerId) {
  const app = await getFirebaseApp();
  const { getAuth, RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth');
  const auth = getAuth(app);
  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
  });
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

/**
 * Confirm the SMS code and return a Firebase ID token. The token is sent to the
 * backend, which verifies it with the Firebase Admin SDK — the plaintext OTP is
 * never sent to (or trusted by) our server.
 * @param {object} confirmationResult
 * @param {string} code 6-digit SMS code
 * @returns {Promise<string>} Firebase ID token
 */
async function confirmPhoneOtp(confirmationResult, code) {
  const { user } = await confirmationResult.confirm(code);
  return user.getIdToken();
}

export { isFirebaseConfigured, sendPhoneOtp, confirmPhoneOtp };
