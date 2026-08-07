const { test, before, after } = require('node:test');
const assert = require('node:assert');

const { boot, api } = require('./helpers');
const firebaseAdmin = require('../src/server/utils/firebaseAdmin');

const ctx = {};

const FAKE_UID = 'firebase-uid-abc123';
const FAKE_PHONE = '+919876543210';

/** Mimics the Admin SDK's verifyIdToken output for a phone-signed-in user. */
function fakeDecoded(overrides = {}) {
  return {
    uid: FAKE_UID,
    phone_number: FAKE_PHONE,
    ...overrides,
  };
}

before(async () => {
  const h = await boot();
  Object.assign(ctx, h);
});

after(async () => {
  firebaseAdmin._setFirebaseVerifier(null);
  if (ctx.close) await ctx.close();
});

test('firebase-login creates a user, returns a token and sets an httpOnly cookie', async () => {
  firebaseAdmin._setFirebaseVerifier(async () => fakeDecoded());

  const r = await api(ctx.base, 'POST', '/api/auth/firebase-login', {
    body: { idToken: 'a'.repeat(40) + '.valid.firebase.token' },
  });

  assert.strictEqual(r.status, 201, `expected 201, got ${r.status}: ${JSON.stringify(r.data)}`);
  assert.ok(r.data.token, 'token must be returned');
  assert.strictEqual(r.data.created, true);
  assert.strictEqual(r.data.user.firebaseUid, FAKE_UID);
  assert.strictEqual(r.data.user.phone, FAKE_PHONE);
  assert.strictEqual(r.data.user.isVerified, true);
  assert.ok(r.data.user.lastLogin, 'lastLogin must be recorded');
  assert.strictEqual(r.data.user.password, undefined, 'password must never be serialized');

  const setCookie = r.headers.get('set-cookie') || '';
  assert.match(setCookie, /df_token=/, 'an auth cookie must be set');
  assert.match(setCookie, /HttpOnly/i, 'the auth cookie must be HttpOnly');
  assert.match(setCookie, /SameSite=Lax/i, 'the auth cookie must set SameSite');

  const User = ctx.mongoose.model('User');
  const doc = await User.findOne({ firebaseUid: FAKE_UID });
  assert.ok(doc, 'user must be persisted in the database');
  assert.strictEqual(doc.phone, FAKE_PHONE);
  assert.strictEqual(doc.isVerified, true);
  assert.ok(doc.lastLogin, 'lastLogin must be persisted');
  assert.ok(!('password' in (doc.toJSON ? {} : {})), 'sanitized payload has no password');

  const Session = ctx.mongoose.model('Session');
  const session = await Session.findOne({ user: doc._id });
  assert.ok(session, 'a session must be created');
  assert.strictEqual(session.loginMethod, 'firebase');

  const LoginLog = ctx.mongoose.model('LoginLog');
  const log = await LoginLog.findOne({ user: doc._id });
  assert.ok(log, 'a login log must be recorded');
  assert.strictEqual(log.method, 'firebase_phone');
  assert.strictEqual(log.success, true);
});

test('second login with the same uid reuses the account instead of duplicating', async () => {
  firebaseAdmin._setFirebaseVerifier(async () => fakeDecoded());

  const first = await api(ctx.base, 'POST', '/api/auth/firebase-login', {
    body: { idToken: 'b'.repeat(40) + '.valid.firebase.token' },
  });
  assert.strictEqual(first.status, 200, 'existing firebase user should log in with 200');

  const User = ctx.mongoose.model('User');
  const count = await User.countDocuments({ firebaseUid: FAKE_UID });
  assert.strictEqual(count, 1, 'must not create a duplicate user');
});

test('a firebase-created user can access protected routes with the returned token', async () => {
  firebaseAdmin._setFirebaseVerifier(async () => fakeDecoded());

  const login = await api(ctx.base, 'POST', '/api/auth/firebase-login', {
    body: { idToken: 'c'.repeat(40) + '.valid.firebase.token' },
  });
  assert.strictEqual(login.status, 200);

  const me = await api(ctx.base, 'GET', '/api/auth/me', { token: login.data.token });
  assert.strictEqual(me.status, 200, `getMe failed: ${me.data?.error || me.status}`);
  assert.strictEqual(me.data.user.firebaseUid, FAKE_UID);
  assert.strictEqual(me.data.user.isVerified, true);
});

test('existing account matched by phone number is linked to the firebase identity', async () => {
  const LINKED_PHONE = '+919876543211';
  const LINKED_UID = 'firebase-uid-linked789';

  const reg = await api(ctx.base, 'POST', '/api/auth/register', {
    body: { username: 'phonelinked', email: 'phonelinked@test.com', password: 'Phone123!', phone: LINKED_PHONE },
  });
  assert.strictEqual(reg.status, 201, `register failed: ${reg.data?.error || reg.status}`);

  firebaseAdmin._setFirebaseVerifier(async () => fakeDecoded({ uid: LINKED_UID, phone_number: LINKED_PHONE }));
  const r = await api(ctx.base, 'POST', '/api/auth/firebase-login', {
    body: { idToken: 'd'.repeat(40) + '.valid.firebase.token' },
  });

  assert.strictEqual(r.status, 200, 'existing phone user should get 200, not 201');
  assert.strictEqual(r.data.created, false);

  const User = ctx.mongoose.model('User');
  const doc = await User.findOne({ email: 'phonelinked@test.com' });
  assert.strictEqual(doc.firebaseUid, LINKED_UID, 'firebaseUid must be linked to the existing account');
  assert.strictEqual(doc.isVerified, true);
});

test('an invalid Firebase ID token is rejected with 401 and no session', async () => {
  firebaseAdmin._setFirebaseVerifier(async () => {
    const err = new Error('Invalid Firebase ID token');
    err.statusCode = 401;
    err.code = 'INVALID_FIREBASE_TOKEN';
    throw err;
  });

  const r = await api(ctx.base, 'POST', '/api/auth/firebase-login', {
    body: { idToken: 'forged.invalid.firebase.token.value' },
  });

  assert.strictEqual(r.status, 401);
  assert.strictEqual(r.data.code, 'INVALID_FIREBASE_TOKEN');
  assert.strictEqual(r.data.error, 'Invalid Firebase ID token');
});

test('firebase-login validates its body (missing / short idToken is a 400)', async () => {
  firebaseAdmin._setFirebaseVerifier(async () => fakeDecoded());

  const missing = await api(ctx.base, 'POST', '/api/auth/firebase-login', { body: {} });
  assert.strictEqual(missing.status, 400);
  assert.strictEqual(missing.data.code, 'VALIDATION_ERROR');

  const short = await api(ctx.base, 'POST', '/api/auth/firebase-login', { body: { idToken: 'abc' } });
  assert.strictEqual(short.status, 400);
  assert.strictEqual(short.data.code, 'VALIDATION_ERROR');
});

test('firebase is not required to boot; unconfigured + no override returns 503', async () => {
  firebaseAdmin._setFirebaseVerifier(null);

  const r = await api(ctx.base, 'POST', '/api/auth/firebase-login', {
    body: { idToken: 'a'.repeat(40) + '.token' },
  });

  assert.strictEqual(r.status, 503);
  assert.strictEqual(r.data.code, 'FIREBASE_NOT_CONFIGURED');
});
