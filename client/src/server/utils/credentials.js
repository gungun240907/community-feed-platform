const Credential = require('../models/Credential');
const { normalizePhone } = require('./phone');

/**
 * Credential store helpers.
 *
 * Authentication credentials (the password hash, keyed by each login
 * identifier) live in a separate `credentials` collection. This lets login be
 * checked against that store directly, decoupled from the user profile.
 */

/**
 * Upsert the credential records for a user. One Credential document is kept per
 * identifier (email / username / phone) so the user can log in with any of
 * them. Stale identifiers (e.g. after an email change) are pruned.
 */
async function upsertCredentials({ userId, email, username, phone, passwordHash }) {
  if (!userId || !passwordHash) return;

  const entries = [];
  if (email) entries.push({ identifier: String(email).toLowerCase(), type: 'email' });
  if (username) entries.push({ identifier: String(username).toLowerCase(), type: 'username' });
  if (phone) {
    const norm = normalizePhone(phone);
    if (norm) entries.push({ identifier: norm, type: 'phone' });
  }

  for (const e of entries) {
    await Credential.updateOne(
      { user: userId, type: e.type },
      { $set: { identifier: e.identifier, passwordHash } },
      { upsert: true }
    );
  }

  const currentIdentifiers = entries.map((e) => e.identifier);
  if (currentIdentifiers.length) {
    await Credential.deleteMany({
      user: userId,
      type: { $in: entries.map((e) => e.type) },
      identifier: { $nin: currentIdentifiers },
    });
  }
}

/**
 * Verify a login attempt against the credentials collection.
 * @returns {Promise<ObjectId|null>} the user id on success, null otherwise.
 */
async function verifyCredential(login, password) {
  if (!login || !password) return null;
  const identifier = String(login).trim().toLowerCase();
  const norm = normalizePhone(login);
  const query = norm ? { $or: [{ identifier }, { identifier: norm }] } : { identifier };

  const cred = await Credential.findOne(query);
  if (!cred) return null;

  const ok = await cred.comparePassword(password);
  return ok ? cred.user : null;
}

module.exports = { upsertCredentials, verifyCredential };
