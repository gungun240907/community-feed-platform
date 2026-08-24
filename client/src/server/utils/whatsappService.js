const axios = require('axios');
const { normalizePhone } = require('./phone');

/**
 * WhatsApp OTP/password delivery via the Meta WhatsApp Cloud API.
 *
 * The Cloud API itself is free to use; you only need a WhatsApp Business
 * Account, a phone number, a permanent access token and a pre-approved
 * message template (the first outbound message to a recipient must use a
 * template). We send the OTP / new password as a single template variable.
 *
 * No extra dependency is required: we POST to the Graph API with axios
 * (already a project dependency). If the service is unconfigured or a send
 * fails we return `false` so the caller can fall back to email.
 */

// Values that clearly mean "not yet filled in" — treat them as unconfigured so
// the app never reports a live WhatsApp channel it cannot actually use.
const PLACEHOLDER_RE = /^(PASTE_|your-|<.*>|CHANGE_|TODO|REPLACE_)/i;

function isPlaceholder(value) {
  return Boolean(value) && (PLACEHOLDER_RE.test(value.trim()) || value.includes(' '));
}

function getConfig() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return {
    accessToken,
    phoneNumberId,
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
    otpTemplate: process.env.WHATSAPP_OTP_TEMPLATE || 'otp',
    resetTemplate: process.env.WHATSAPP_RESET_TEMPLATE || 'password_reset',
    configured:
      Boolean(accessToken && phoneNumberId) &&
      !isPlaceholder(accessToken) &&
      !isPlaceholder(phoneNumberId),
  };
}

function isConfigured() {
  return getConfig().configured;
}

/**
 * Send a WhatsApp template message.
 * @param {{ to: string, template: string, bodyVariables: (string|number)[] }} opts
 * @returns {Promise<boolean>} true if Meta accepted the message
 */
async function sendTemplateMessage({ to, template, bodyVariables = [] }) {
  const { accessToken, phoneNumberId, apiVersion } = getConfig();
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template,
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: bodyVariables.map((v) => ({ type: 'text', text: String(v) })),
        },
      ],
    },
  };

  try {
    const res = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    const accepted = Boolean(
      res.data && res.data.messages && res.data.messages[0] && res.data.messages[0].id
    );
    if (!accepted) {
      console.error('[whatsappService] Unexpected response:', JSON.stringify(res.data).slice(0, 300));
    }
    return accepted;
  } catch (err) {
    const detail =
      err.response && err.response.data ? JSON.stringify(err.response.data).slice(0, 300) : err.message;
    console.error('[whatsappService] sendTemplateMessage failed:', detail);
    return false;
  }
}

/** Send an OTP code to a phone number via WhatsApp. */
async function sendOtp(rawPhone, code) {
  const to = normalizePhone(rawPhone);
  if (!to) {
    console.error('[whatsappService] Invalid phone for OTP:', rawPhone);
    return false;
  }
  return sendTemplateMessage({ to, template: getConfig().otpTemplate, bodyVariables: [code] });
}

/** Send a new password to a phone number via WhatsApp. */
async function sendPasswordReset(rawPhone, password) {
  const to = normalizePhone(rawPhone);
  if (!to) {
    console.error('[whatsappService] Invalid phone for password reset:', rawPhone);
    return false;
  }
  return sendTemplateMessage({
    to,
    template: getConfig().resetTemplate,
    bodyVariables: [password],
  });
}

module.exports = { getConfig, isConfigured, sendTemplateMessage, sendOtp, sendPasswordReset };
