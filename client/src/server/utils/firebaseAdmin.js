/**
 * Firebase Admin SDK wrapper.
 *
 * Initializes lazily from server-side environment variables so the app can
 * boot (and run its test suite) without Firebase credentials configured.
 * The service-account private key is NEVER exposed to the frontend — it only
 * ever lives in the server environment.
 *
 * Required (production):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 *
 * The private key is expected to be the raw JSON value from the service
 * account file. Some hosts escape `\n` in env vars; we normalize that here.
 */

let adminApp = null;
let verifierOverride = null;

function normalizePrivateKey(key) {
  return String(key).replace(/\\n/g, '\n');
}

function loadPrivateKey() {
  const file = process.env.FIREBASE_PRIVATE_KEY_FILE;
  if (!file) return process.env.FIREBASE_PRIVATE_KEY;

  try {
    const parsed = JSON.parse(require('fs').readFileSync(file, 'utf8'));
    return parsed.private_key;
  } catch (err) {
    const e = new Error(`Failed to read FIREBASE_PRIVATE_KEY_FILE: ${err.message}`);
    e.statusCode = 503;
    e.code = 'FIREBASE_NOT_CONFIGURED';
    throw e;
  }
}

function isConfigured() {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    (process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY_FILE)
  );
}

function getAdmin() {
  if (adminApp) return adminApp;
  if (!isConfigured()) {
    const err = new Error('Firebase Admin is not configured');
    err.statusCode = 503;
    err.code = 'FIREBASE_NOT_CONFIGURED';
    throw err;
  }

  const admin = require('firebase-admin');
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(loadPrivateKey());

  adminApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  return adminApp;
}

/**
 * Verify a Firebase ID token (never trust the frontend).
 * @param {string} idToken
 * @returns {Promise<{uid: string, phoneNumber?: string, email?: string, name?: string, picture?: string}>}
 */
async function verifyFirebaseIdToken(idToken) {
  let decoded;
  if (verifierOverride) {
    decoded = await verifierOverride(idToken);
  } else {
    const admin = getAdmin();
    try {
      decoded = await admin.auth().verifyIdToken(idToken, true);
    } catch (err) {
      const error = new Error('Invalid Firebase ID token');
      error.statusCode = 401;
      error.code = 'INVALID_FIREBASE_TOKEN';
      throw error;
    }
  }

  return {
    uid: decoded.uid,
    phoneNumber: decoded.phoneNumber || decoded.phone_number || undefined,
    email: decoded.email || undefined,
    name: decoded.name || undefined,
    picture: decoded.picture || undefined,
  };
}

/**
 * Test-only hook so the /auth/firebase-login endpoint can be exercised without
 * real Firebase credentials. Pass null to restore the real implementation.
 * This is intentionally never wired to any route.
 */
function _setFirebaseVerifier(fn) {
  verifierOverride = fn || null;
}

module.exports = {
  isConfigured,
  verifyFirebaseIdToken,
  _setFirebaseVerifier,
};
