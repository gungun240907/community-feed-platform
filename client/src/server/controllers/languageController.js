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

    // TODO: Phone/SMS verification was removed (Firebase + MSG91). All
    // language switches are verified via email OTP until a new SMS provider
    // is added per the pending instruction.
    const contact = req.user.email;

    if (!contact) {
      return res.status(400).json({
        error: 'No email address found. Please update your profile first.',
        missingField: 'email',
      });
    }

    const result = await createAndSendOtp({
      user: req.user,
      purpose: 'language_switch',
      type: 'email',
      ip: getClientIp(req),
    });

    return res.json({
      message: 'OTP sent to your email.',
      type: 'email',
      channel: 'email',
      language,
      delivery: { channel: 'email', contact: req.user.email },
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
