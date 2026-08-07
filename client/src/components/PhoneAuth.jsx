import React, { useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Phone, Loader2, ArrowLeft, ShieldCheck, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';
import { isFirebaseConfigured, sendPhoneOtp, confirmPhoneOtp } from '../utils/firebaseClient';

const OTP_LENGTH = 6;
const RESEND_COUNTDOWN_SECONDS = 30;

const FIREBASE_ERRORS = {
  'auth/invalid-phone-number': 'phoneAuth.errors.invalidPhone',
  'auth/missing-phone-number': 'phoneAuth.errors.invalidPhone',
  'auth/invalid-verification-code': 'phoneAuth.errors.wrongOtp',
  'auth/code-expired': 'phoneAuth.errors.codeExpired',
  'auth/session-expired': 'phoneAuth.errors.sessionExpired',
  'auth/too-many-requests': 'phoneAuth.errors.tooManyRequests',
  'auth/quota-exceeded': 'phoneAuth.errors.tooManyRequests',
  'auth/network-request-failed': 'phoneAuth.errors.network',
  'auth/internal-error': 'phoneAuth.errors.generic',
};

function friendlyError(t, err) {
  const key = FIREBASE_ERRORS[err?.code];
  if (key) return t(key);
  if (err?.code) return err.message || t('phoneAuth.errors.generic');
  return t('phoneAuth.errors.generic');
}

function isValidPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function OtpInput({ value, onChange, disabled, onComplete }) {
  const inputRefs = useRef([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] || '');

  const update = (next) => {
    const code = next.join('');
    onChange(code);
    if (code.length === OTP_LENGTH) onComplete?.(code);
  };

  const handleChange = (i, val) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = digit;
    update(next);
    if (digit && i < OTP_LENGTH - 1) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) {
        const next = [...digits];
        next[i] = '';
        update(next);
      } else if (i > 0) {
        inputRefs.current[i - 1]?.focus();
      }
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((c, i) => (next[i] = c));
    update(next);
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  return (
    <div className="flex justify-between gap-2" onPaste={handlePaste}>
      {Array.from({ length: OTP_LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digits[i]}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={`w-11 h-12 sm:w-12 sm:h-14 rounded-xl border-2 text-center text-xl font-bold text-surface-900 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
            digits[i] ? 'border-primary-300' : 'border-surface-200'
          } disabled:opacity-60`}
          aria-label={`OTP digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

export default function PhoneAuth({ onComplete }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { firebaseLogin } = useAuth();

  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [verified, setVerified] = useState(false);

  const confirmationRef = useRef(null);
  const countdownRef = useRef(null);

  const configured = typeof window === 'undefined' ? false : isFirebaseConfigured();

  const startCountdown = () => {
    setCountdown(RESEND_COUNTDOWN_SECONDS);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((s) => {
        if (s <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setError('');
    if (!isValidPhone(phone)) {
      setError(t('phoneAuth.errors.invalidPhone'));
      return;
    }
    setSending(true);
    try {
      confirmationRef.current = await sendPhoneOtp(phone, 'phone-auth-recaptcha');
      startCountdown();
      setStep('otp');
    } catch (err) {
      setError(friendlyError(t, err));
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setOtp('');
    setSending(true);
    try {
      confirmationRef.current = await sendPhoneOtp(phone, 'phone-auth-recaptcha');
      startCountdown();
    } catch (err) {
      setError(friendlyError(t, err));
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (e, code) => {
    e?.preventDefault();
    const otpValue = code ?? otp;
    setError('');
    if (otpValue.length !== OTP_LENGTH) {
      setError(t('phoneAuth.errors.wrongOtp'));
      return;
    }
    setVerifying(true);
    try {
      const idToken = await confirmPhoneOtp(confirmationRef.current, otpValue);
      await firebaseLogin(idToken);
      setVerified(true);
      setTimeout(() => {
        onComplete?.();
        router.push('/');
      }, 700);
    } catch (err) {
      setError(friendlyError(t, err));
    } finally {
      setVerifying(false);
    }
  };

  if (verified) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-3 animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center">
          <CheckCircle size={28} className="text-green-600" />
        </div>
        <p className="text-sm font-medium text-surface-700">{t('phoneAuth.success')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Invisible reCAPTCHA host — Firebase renders the badge/verifier here. */}
      <div id="phone-auth-recaptcha" />

      {!configured && (
        <div className="bg-amber-50 text-amber-700 text-sm p-3.5 rounded-xl border border-amber-200">
          {t('phoneAuth.errors.notConfigured')}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3.5 rounded-xl border border-red-200 animate-slide-down flex items-start gap-2">
          <span className="mt-0.5">•</span>
          <span>{error}</span>
        </div>
      )}

      {step === 'phone' ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-700">{t('phoneAuth.phoneLabel')}</label>
            <div className="relative">
              <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                type="tel"
                inputMode="tel"
                className="input-field pl-11"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                autoComplete="tel"
                required
              />
            </div>
            <p className="text-xs text-surface-400">{t('phoneAuth.phoneHint')}</p>
          </div>
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={sending || !configured || !phone.trim()}
          >
            {sending ? <Loader2 size={18} className="animate-spin mr-2" /> : <ShieldCheck size={18} className="mr-2" />}
            {sending ? t('phoneAuth.sending') : t('phoneAuth.sendOtp')}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep('phone')}
              className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-600 transition-colors"
            >
              <ArrowLeft size={16} />
              {t('common.goBack')}
            </button>
            <span className="text-xs text-surface-400 font-medium truncate max-w-[180px]">{phone}</span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-700">{t('phoneAuth.otpLabel')}</label>
            <OtpInput value={otp} onChange={setOtp} disabled={verifying} onComplete={(code) => handleVerify(undefined, code)} />
            <p className="text-xs text-surface-400">{t('phoneAuth.otpHint')}</p>
          </div>

          <button
            type="button"
            onClick={handleResend}
            disabled={countdown > 0 || sending || verifying}
            className="w-full text-sm font-medium text-primary-600 hover:text-primary-700 disabled:text-surface-400 transition-colors"
          >
            {sending && <Loader2 size={14} className="animate-spin inline mr-1.5" />}
            {countdown > 0
              ? `${t('phoneAuth.resendIn')} ${countdown}s`
              : t('phoneAuth.resend')}
          </button>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={otp.length !== OTP_LENGTH || verifying}
          >
            {verifying ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
            {verifying ? t('phoneAuth.verifying') : t('phoneAuth.verifyButton')}
          </button>
        </form>
      )}
    </div>
  );
}
