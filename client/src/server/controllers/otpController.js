const { createAndSendOtp, verifyOtp } = require('../utils/otpService');

async function requestOtp(req, res, next) {
  try {
    const { purpose, type } = req.body;

    if (!purpose) {
      return res.status(400).json({ error: 'OTP purpose is required' });
    }

    const validPurposes = ['email_verification', 'phone_verification', 'password_reset', 'login_verification', 'language_switch'];
    if (!validPurposes.includes(purpose)) {
      return res.status(400).json({ error: 'Invalid OTP purpose' });
    }

    const otpType = type === 'phone' ? 'phone' : 'email';
    const io = req.app.get('io');

    const code = await createAndSendOtp({
      user: req.user,
      purpose,
      type: otpType,
      request: req,
      io,
    });

    res.json({
      message: `OTP sent to your ${otpType} and via real-time connection.`,
      type: otpType,
      purpose,
    });
  } catch (error) {
    next(error);
  }
}

async function verifyOtpEndpoint(req, res, next) {
  try {
    const { purpose, code } = req.body;

    if (!purpose || !code) {
      return res.status(400).json({ error: 'Purpose and code are required' });
    }

    const result = await verifyOtp({
      userId: req.user._id,
      purpose,
      code,
    });

    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      message: 'OTP verified successfully',
      verified: true,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { requestOtp, verifyOtpEndpoint };
