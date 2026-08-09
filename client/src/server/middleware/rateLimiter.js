const { rateLimit } = require('express-rate-limit');
const { getClientIp } = require('./auth');

/**
 * Reusable Express rate limiters.
 *
 * Limits are read from environment variables so production can tune them
 * without code changes, and tests can lower them to exercise 429 responses.
 * Rate limiting is layered on top of the per-OTP attempt cap in otpService:
 *  - request/verify/resend endpoints get per-IP windows (brute-force protection)
 *  - /auth/login gets a per-IP window (credential-stuffing protection)
 */

function envInt(name, fallback) {
  const raw = parseInt(process.env[name], 10);
  return Number.isInteger(raw) && raw > 0 ? raw : fallback;
}

function limiter(key, windowMs, max, message) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => getClientIp(req) || 'unknown',
    handler: (req, res, _next, options) => {
      res.setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
      res.status(options.statusCode).json({
        error: message,
        code: 'RATE_LIMITED',
        retryAfterMs: options.windowMs,
      });
    },
    skip: () => process.env.DISABLE_RATE_LIMITING === 'true',
  });
}

const OTP_WINDOW_MS = envInt('RATE_LIMIT_OTP_WINDOW_MS', 10 * 60 * 1000);

/** Maximum OTP *requests* per IP per window (request + resend share the budget). */
const otpRequestLimiter = limiter(
  'otp-request',
  OTP_WINDOW_MS,
  envInt('RATE_LIMIT_OTP_REQUEST_MAX', 10),
  'Too many OTP requests. Please try again later.'
);

/** Maximum OTP *verification attempts* per IP per window. */
const otpVerifyLimiter = limiter(
  'otp-verify',
  OTP_WINDOW_MS,
  envInt('RATE_LIMIT_OTP_VERIFY_MAX', 20),
  'Too many OTP verification attempts. Please try again later.'
);

/** Maximum password-less login OTP resends per IP per window. */
const resendLoginOtpLimiter = limiter(
  'resend-login-otp',
  OTP_WINDOW_MS,
  envInt('RATE_LIMIT_RESEND_LOGIN_OTP_MAX', 10),
  'Too many OTP resend requests. Please try again later.'
);

/** Login endpoint: prevents credential stuffing / online password guessing. */
const authLoginLimiter = limiter(
  'auth-login',
  envInt('RATE_LIMIT_LOGIN_WINDOW_MS', 15 * 60 * 1000),
  envInt('RATE_LIMIT_LOGIN_MAX', 50),
  'Too many login attempts. Please try again later.'
);

/** Verify-login-OTP endpoint. */
const verifyLoginOtpLimiter = limiter(
  'verify-login-otp',
  OTP_WINDOW_MS,
  envInt('RATE_LIMIT_VERIFY_LOGIN_OTP_MAX', 20),
  'Too many OTP verification attempts. Please try again later.'
);

/** Forgot-password endpoint: prevent account harvesting via email floods. */
const forgotPasswordLimiter = limiter(
  'forgot-password',
  envInt('RATE_LIMIT_FORGOT_PASSWORD_WINDOW_MS', 60 * 60 * 1000),
  envInt('RATE_LIMIT_FORGOT_PASSWORD_MAX', 10),
  'Too many password reset requests. Please try again later.'
);

module.exports = {
  otpRequestLimiter,
  otpVerifyLimiter,
  resendLoginOtpLimiter,
  authLoginLimiter,
  verifyLoginOtpLimiter,
  forgotPasswordLimiter,
};
