const crypto = require('crypto');

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const ALL_LETTERS = UPPERCASE + LOWERCASE;
const DEFAULT_LENGTH = 14;

function secureRandomIndex(max) {
  return crypto.randomInt(0, max);
}

function generatePassword(length = DEFAULT_LENGTH) {
  let password = '';

  password += UPPERCASE[secureRandomIndex(UPPERCASE.length)];
  password += LOWERCASE[secureRandomIndex(LOWERCASE.length)];

  for (let i = password.length; i < length; i++) {
    password += ALL_LETTERS[secureRandomIndex(ALL_LETTERS.length)];
  }

  password = password
    .split('')
    .sort(() => secureRandomIndex(2) - 1)
    .join('');

  return password;
}

module.exports = { generatePassword };
