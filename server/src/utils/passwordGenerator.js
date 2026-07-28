const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const ALL_LETTERS = UPPERCASE + LOWERCASE;
const DEFAULT_LENGTH = 14;

function generatePassword(length = DEFAULT_LENGTH) {
  let password = '';

  password += UPPERCASE[Math.floor(Math.random() * UPPERCASE.length)];
  password += LOWERCASE[Math.floor(Math.random() * LOWERCASE.length)];

  for (let i = password.length; i < length; i++) {
    password += ALL_LETTERS[Math.floor(Math.random() * ALL_LETTERS.length)];
  }

  password = password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');

  return password;
}

module.exports = { generatePassword };
