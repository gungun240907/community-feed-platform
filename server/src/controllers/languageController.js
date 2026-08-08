const { createAndSendOtp, verifyOtp } = require('../utils/otpService');
const { isFirebaseConfigured, verifyPhoneCode, maskPhone } = require('../utils/firebaseService');

const VALID_LANGUAGES = ['en', 'es', 'hi', 'pt', 'zh', 'fr'];

async function requestLanguageSwitch(req, res, next) {
  try {
    const { language } = req.body;

    if (!VALID_LANGUAGES.includes(language)) {
      return res.status(400).json({ error: 'Invalid language' });
    }

    if (language === (req.user.language || 'en')) {
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

    if (useEmail) {
      const delivery = await createAndSendOtp({
        user: req.user,
        purpose: 'language_switch',
        type: 'email',
        request: req,
      });

      return res.json({
        message: 'OTP sent to your email.',
        type: 'email',
        channel: 'email',
        language,
        delivery,
      });
    }

    if (!isFirebaseConfigured()) {
      return res.status(503).json({
        error: 'SMS verification is not configured. Please ask an administrator to set up Firebase.',
      });
    }

    res.json({
      message: 'SMS code sent to your phone.',
      type: 'phone',
      channel: 'phone',
      language,
      delivery: { channel: 'sms', contact: maskPhone(contact) },
    });
  } catch (error) {
    next(error);
  }
}

async function verifyLanguageSwitch(req, res, next) {
  try {
    const { language, otp, verificationId, code } = req.body;

    if (!VALID_LANGUAGES.includes(language)) {
      return res.status(400).json({ error: 'Invalid language' });
    }

    if (verificationId && code) {
      const result = await verifyPhoneCode({
        verificationId,
        code,
        phoneNumber: req.user.phone,
      });

      if (!result || result.phoneNumber !== req.user.phone) {
        return res.status(400).json({ error: 'This OTP was not sent to your phone number.' });
      }
    } else if (otp) {
      const result = await verifyOtp({
        userId: req.user._id,
        purpose: 'language_switch',
        code: otp,
      });

      if (!result.valid) {
        return res.status(400).json({ error: result.error });
      }
    } else {
      return res.status(400).json({ error: 'OTP or verificationId+code is required' });
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
