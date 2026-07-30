const Otp = require('../models/Otp');
const { createAndSendOtp, verifyOtp } = require('../utils/otpService');

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

    const useEmail = language === 'fr';
    const contact = useEmail ? req.user.email : req.user.phone;

    if (!contact) {
      return res.status(400).json({
        error: useEmail
          ? 'No email address found. Please update your profile first.'
          : 'No phone number found. Please update your profile first.',
        missingField: useEmail ? 'email' : 'phone',
      });
    }

    const io = req.app.get('io');
    await createAndSendOtp({
      user: req.user,
      purpose: 'language_switch',
      type: useEmail ? 'email' : 'phone',
      request: req,
      io,
    });

    res.json({
      message: `OTP sent to your ${useEmail ? 'email' : 'phone'} and via real-time connection.`,
      type: useEmail ? 'email' : 'phone',
      language,
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

    const result = await verifyOtp({
      userId: req.user._id,
      purpose: 'language_switch',
      code: otp,
    });

    if (!result.valid) {
      return res.status(400).json({ error: result.error });
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
