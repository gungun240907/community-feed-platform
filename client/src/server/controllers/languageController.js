const { createAndSendOtp, verifyOtp } = require('../utils/otpService');
const { getClientIp } = require('../middleware/auth');

const VALID_LANGUAGES = ['en', 'es', 'hi', 'pt', 'zh', 'fr'];

async function requestLanguageSwitch(req, res, next) {
  try {
    const { language } = req.body;

    if (!VALID_LANGUAGES.includes(language)) {
      return res.status(400).json({ error: 'Invalid language' });
    }

    if (language === req.user.language || language === (req.user.language || 'en')) {
      return res.status(400).json({ error: 'Language is already set to this value' });
    }

    // Security: French switches are verified via the user's EMAIL, while all
    // other languages are verified via the registered MOBILE number (SMS).
    const otpType = language === 'fr' ? 'email' : 'phone';
    const contact = otpType === 'email' ? req.user.email : req.user.phone;

    if (!contact) {
      return res.status(400).json({
        error:
          otpType === 'email'
            ? 'No email address found. Please update your profile first.'
            : 'No mobile number found. Please update your profile first.',
        missingField: otpType,
      });
    }

    const result = await createAndSendOtp({
      user: req.user,
      purpose: 'language_switch',
      type: otpType,
      language,
      ip: getClientIp(req),
    });

    // Report the channel that was ACTUALLY used. When SMS/WhatsApp is
    // unconfigured (or fails) the OTP is emailed, so we must not tell the user
    // it went to their phone — that would be a misleading UI/explanation mismatch.
    const deliveredVia = result.deliveredVia; // 'sms' | 'whatsapp' | 'email'
    const actualChannel = deliveredVia === 'email' ? 'email' : 'phone';
    const actualContact = actualChannel === 'phone' ? req.user.phone : req.user.email;
    const methodLabel =
      deliveredVia === 'sms'
        ? ' via SMS'
        : deliveredVia === 'whatsapp'
        ? ' via WhatsApp'
        : '';

    return res.json({
      message: `OTP sent to your ${actualChannel}${methodLabel}.`,
      type: otpType,
      channel: actualChannel,
      language,
      delivery: { channel: actualChannel, contact: actualContact, method: deliveredVia },
      retryAfterMs: result.retryAfterMs,
    });
  } catch (error) {
    next(error);
  }
}

async function verifyLanguageSwitch(req, res, next) {
  try {
    const { language, otp } = req.body;

    if (!VALID_LANGUAGES.includes(language)) {
      return res.status(400).json({ error: 'Invalid language' });
    }

    if (!otp) {
      return res.status(400).json({ error: 'OTP is required' });
    }

    const result = await verifyOtp({
      userId: req.user._id,
      purpose: 'language_switch',
      code: otp,
    });

    if (!result.valid) {
      const status = result.code === 'LOCKED' ? 429 : 400;
      return res.status(status).json({
        error: result.error,
        code: result.code,
        ...(typeof result.remaining === 'number' ? { attemptsRemaining: result.remaining } : {}),
      });
    }

    // The OTP must have been issued for the exact language being switched to.
    // This enforces the channel rule (fr -> email, all others -> phone) because
    // the OTP's delivery channel is chosen from the requested language at issue
    // time. A French (email) OTP therefore cannot switch the account to Spanish.
    const issuedLanguage = result.otpDoc && result.otpDoc.language;
    if (issuedLanguage && issuedLanguage !== language) {
      return res.status(400).json({
        error: 'This verification code was issued for a different language. Please request a new code.',
        code: 'LANGUAGE_MISMATCH',
      });
    }

    req.user.language = language;
    await req.user.save();

    res.json({
      message: `Language changed to ${language}`,
      language,
      user: { _id: req.user._id, language: req.user.language },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { requestLanguageSwitch, verifyLanguageSwitch };
