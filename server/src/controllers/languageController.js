const crypto = require('crypto');
const Otp = require('../models/Otp');
const User = require('../models/User');
const twilio = require('twilio');

const VALID_LANGUAGES = ['en', 'es', 'hi', 'pt', 'zh', 'fr'];

function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

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

    await Otp.deleteMany({ user: req.user._id, purpose: 'language_switch', verified: false });

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.create({
      user: req.user._id,
      code,
      type: useEmail ? 'email' : 'phone',
      purpose: 'language_switch',
      expiresAt,
    });

    const nodemailer = require('nodemailer');
    let transporter = null;
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
    }

    if (useEmail) {
      if (transporter) {
        await transporter.sendMail({
          from: `"DevFeed" <${process.env.SMTP_FROM || 'noreply@devfeed.com'}>`,
          to: contact,
          subject: 'Your OTP for language change',
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;text-align:center;">
            <h2>Language Change Verification</h2>
            <p>Your OTP code is:</p>
            <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f3f4f6;padding:16px;border-radius:12px;margin:16px 0;">${code}</div>
            <p style="color:#6b7280;font-size:14px;">This code expires in 10 minutes.</p>
          </div>`,
        });
        console.log(`OTP email sent to ${contact}`);
      } else {
        console.log(`Email service not configured. OTP for ${contact}: ${code}`);
      }
    } else {
      const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
        ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
        : null;
      if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
        await twilioClient.messages.create({
          body: `Your DevFeed OTP is: ${code}. It expires in 10 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: contact,
        });
        console.log(`OTP SMS sent to ${contact}`);
      } else {
        console.log(`SMS not configured. OTP for ${contact}: ${code}`);
      }
    }

    res.json({
      message: `OTP sent to your ${useEmail ? 'email' : 'phone'}.`,
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
    if (!otp || otp.length !== 6) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const otpDoc = await Otp.findOne({
      user: req.user._id,
      purpose: 'language_switch',
      verified: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      return res.status(400).json({ error: 'OTP expired or not found. Please request a new one.' });
    }

    if (otpDoc.code !== otp) {
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    }

    otpDoc.verified = true;
    await otpDoc.save();

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
