const twilio = require('twilio');

let client = null;

function isTwilioConfigured() {
  const hasAuthToken = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  const hasApiKey = !!(process.env.TWILIO_API_KEY && process.env.TWILIO_API_SECRET);
  return hasAuthToken || hasApiKey;
}

function getTwilioClient() {
  if (!isTwilioConfigured()) return null;
  if (!client) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;

    if (apiKey && apiSecret) {
      client = twilio(apiKey, apiSecret, { accountSid });
    } else {
      client = twilio(accountSid, authToken);
    }
  }
  return client;
}

function getFrom() {
  return process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER || '';
}

function normalizePhoneNumber(phone) {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/[\s()-]/g, '');
  const withPrefix = stripped.startsWith('+')
    ? stripped
    : process.env.TWILIO_DEFAULT_COUNTRY_CODE
      ? `+${process.env.TWILIO_DEFAULT_COUNTRY_CODE}${stripped}`
      : null;
  return withPrefix && /^\+\d{8,15}$/.test(withPrefix) ? withPrefix : null;
}

async function sendSms({ to, body }) {
  const client = getTwilioClient();
  if (!client) return { sent: false, reason: 'not_configured' };

  const from = getFrom();
  if (!from) return { sent: false, reason: 'not_configured' };

  const dltEntityId = process.env.TWILIO_DLT_ENTITY_ID;
  const dltTemplateId = process.env.TWILIO_DLT_TEMPLATE_ID;

  const message = await client.messages.create({
    to,
    body,
    ...(from.startsWith('MG') ? { messagingServiceSid: from } : { from }),
    ...(dltEntityId && dltTemplateId ? { dltEntityId, dltTemplateId } : {}),
  });

  return { sent: true, sid: message.sid };
}

module.exports = { sendSms, isTwilioConfigured, normalizePhoneNumber };
