const { z } = require('zod');
const { VALID_PURPOSES, OTP_LENGTH } = require('../utils/otpService');

/**
 * Request-body validation middleware built on zod.
 * All public routes should validate input before touching business logic.
 * On failure a 400 with field-level details is returned; no internals leaked.
 */

const otpRequestSchema = z.object({
  purpose: z.enum(VALID_PURPOSES, { errorMap: () => ({ message: 'Invalid OTP purpose' }) }),
  type: z.enum(['email', 'phone']).optional(),
});

const otpVerifySchema = z.object({
  purpose: z.enum(VALID_PURPOSES, { errorMap: () => ({ message: 'Invalid OTP purpose' }) }),
  code: z
    .string()
    .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), { message: `Code must be a ${OTP_LENGTH}-digit number` }),
});

const otpResendSchema = z.object({
  purpose: z.enum(VALID_PURPOSES, { errorMap: () => ({ message: 'Invalid OTP purpose' }) }),
  type: z.enum(['email', 'phone']).optional(),
});

/** Body for /api/auth/resend-login-otp (re-authenticates before re-sending). */
const resendLoginOtpSchema = z.object({
  login: z.string().min(1, { message: 'Username/email is required' }).max(100),
  password: z.string().min(1, { message: 'Password is required' }).max(200),
});

/** Body for /api/auth/firebase-login — a Firebase ID token from the client SDK. */
const firebaseLoginSchema = z.object({
  idToken: z
    .string()
    .min(20, { message: 'A Firebase ID token is required' })
    .max(8192, { message: 'Invalid Firebase ID token' }),
});

/**
 * Body for /api/auth/register. Field rules mirror the User model so invalid
 * payloads fail fast with a 400 before touching the database.
 */
const registerSchema = z.object({
  username: z
    .string()
    .min(3, { message: 'Username must be at least 3 characters' })
    .max(30, { message: 'Username cannot exceed 30 characters' }),
  email: z
    .string()
    .email({ message: 'A valid email is required' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' }),
  displayName: z
    .string()
    .max(50, { message: 'Display name cannot exceed 50 characters' })
    .optional(),
  phone: z
    .string()
    .max(20, { message: 'Phone number is too long' })
    .optional(),
});

/**
 * Express middleware that validates req.body against a zod schema.
 * Parsed (coerced) values are attached to req.validated.
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body || {});
    if (!result.success) {
      const fields = result.error.issues.reduce((acc, issue) => {
        const key = issue.path.join('.') || 'body';
        acc[key] = issue.message;
        return acc;
      }, {});
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        fields,
      });
    }
    req.validated = result.data;
    next();
  };
}

module.exports = {
  validate,
  otpRequestSchema,
  otpVerifySchema,
  otpResendSchema,
  resendLoginOtpSchema,
  firebaseLoginSchema,
  registerSchema,
};
