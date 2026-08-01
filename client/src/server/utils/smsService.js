let twilio = null;
let TWILIO_FROM = null;

function initTwilio() {
  if (twilio) return twilio;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  TWILIO_FROM = process.env.TWILIO_FROM_NUMBER || null;
  if (accountSid && authToken && TWILIO_FROM) {
    try {
      const client = require('twilio');
      twilio = client(accountSid, authToken);
    } catch (e) {
      console.warn('Twilio failed to initialize:', e.message);
      twilio = null;
    }
  }
  return twilio;
}

function isSmsConfigured() {
  return !!initTwilio();
}

async function sendSms(to, body) {
  const client = initTwilio();
  if (!client) {
    console.log('SMS service not configured. Skipping SMS.');
    console.log(`SMS to ${to}: ${body}`);
    return false;
  }
  try {
    await client.messages.create({
      to,
      from: TWILIO_FROM,
      body,
    });
    console.log(`SMS sent to ${to}`);
    return true;
  } catch (err) {
    console.error('Failed to send SMS:', err.message);
    return false;
  }
}

async function sendOtpSms(user, otp, purpose) {
  if (!user.phone) return false;
  const purposeLabel = purpose === 'language_switch' ? 'language change' : 'verification';
  return sendSms(user.phone, `Your DevFeed ${purposeLabel} code is ${otp}. It expires in 10 minutes.`);
}

async function sendPasswordResetSms(user, newPassword) {
  if (!user.phone) return false;
  return sendSms(user.phone, `Your DevFeed password has been reset. Your new password is: ${newPassword}. Sign in and change it from your profile.`);
}

module.exports = { isSmsConfigured, sendSms, sendOtpSms, sendPasswordResetSms };
