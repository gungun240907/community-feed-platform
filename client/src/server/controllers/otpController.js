const { createAndSendOtp, verifyOtp, getOtpStatus } = require('../utils/otpService');
const { getClientIp } = require('../middleware/auth');

/**
 * OTP endpoints. All routes are authenticated (the requester must already
 * have a session). Unauthenticated OTP flows (login verification) live under
 * /api/auth (see authController).
 *
 * The plaintext OTP is NEVER included in any response.
 */

async function requestOtp(req, res, next) {
  try {
    const { purpose, type } = req.validated;
    const otpType = type || 'email';

    if (otpType === 'phone' && !req.user.phone) {
      return res.status(400).json({
        error: 'No phone number found. Please update your profile first.',
        code: 'MISSING_PHONE',
      });
    }

    const result = await createAndSendOtp({
      user: req.user,
      purpose,
      type: otpType,
      ip: getClientIp(req),
    });

    res.json({
      message: `OTP sent to your ${otpType}.`,
      type: otpType,
      purpose,
      expiresInMs: result.expiresAt.getTime() - Date.now(),
      retryAfterMs: result.retryAfterMs,
    });
  } catch (error) {
    next(error);
  }
}

async function verifyOtpEndpoint(req, res, next) {
  try {
    const { purpose, code } = req.validated;
    const result = await verifyOtp({
      userId: req.user._id,
      purpose,
      code,
    });

    if (!result.valid) {
      const status = result.code === 'LOCKED' ? 429 : 400;
      return res.status(status).json({
        error: result.error,
        code: result.code,
        ...(typeof result.remaining === 'number' ? { attemptsRemaining: result.remaining } : {}),
      });
    }

    res.json({
      message: 'OTP verified successfully',
      verified: true,
      purpose,
    });
  } catch (error) {
    next(error);
  }
}

async function resendOtp(req, res, next) {
  try {
    const { purpose, type } = req.validated;
    const otpType = type || 'email';

    if (otpType === 'phone' && !req.user.phone) {
      return res.status(400).json({
        error: 'No phone number found. Please update your profile first.',
        code: 'MISSING_PHONE',
      });
    }

    // createAndSendOtp enforces the resend cooldown and throws a 429 when the
    // previous code is still within the cooldown window.
    const result = await createAndSendOtp({
      user: req.user,
      purpose,
      type: otpType,
      ip: getClientIp(req),
    });

    res.json({
      message: 'A new OTP has been sent.',
      type: otpType,
      purpose,
      expiresInMs: result.expiresAt.getTime() - Date.now(),
      retryAfterMs: result.retryAfterMs,
    });
  } catch (error) {
    next(error);
  }
}

/** Informational endpoint so the UI can render a live resend countdown. */
async function otpStatus(req, res, next) {
  try {
    const { purpose } = req.validated;
    const status = await getOtpStatus({ userId: req.user._id, purpose });
    res.json({ purpose, ...status });
  } catch (error) {
    next(error);
  }
}

module.exports = { requestOtp, verifyOtpEndpoint, resendOtp, otpStatus };
