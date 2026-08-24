/**
 * Normalize a stored phone number into E.164 format for WhatsApp/SMS delivery.
 *
 * User.phone is currently a free-form string, so this best-effort helper:
 *  - strips spaces, dashes, parentheses and dots
 *  - keeps/adds a leading '+'
 *  - treats '00' prefixes as '+'
 *  - assumes Indian (+91) for bare 10-digit mobile numbers (this project's
 *    audience uses INR pricing), otherwise just prepends '+'
 *
 * Returns the normalized string, or null when the input cannot be made valid.
 */
function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') return null;

  let s = raw.replace(/[\s\-().]/g, '').trim();
  if (!s) return null;

  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (!s.startsWith('+')) {
    const digits = s.replace(/\D/g, '');
    if (/^\d{10}$/.test(digits)) {
      // Bare 10-digit mobile -> assume India.
      s = '+91' + digits;
    } else {
      s = '+' + digits;
    }
  }

  // E.164: '+' followed by 8-15 digits, first digit not 0.
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null;
  return s;
}

module.exports = { normalizePhone };
