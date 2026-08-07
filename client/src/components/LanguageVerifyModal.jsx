import React, { useState, useEffect } from 'react';
import { X, Loader2, Send, AlertCircle, Mail, Phone } from 'lucide-react';
import { languageAPI } from '../utils/api';
import { useTranslation } from '../context/I18nContext';

const LANG_LABELS = { en: 'English', es: 'Spanish', hi: 'Hindi', pt: 'Portuguese', zh: 'Chinese', fr: 'French' };
const RESEND_COOLDOWN_SECONDS = 60;

export default function LanguageVerifyModal({ targetLang, onClose, onVerified }) {
  const { t } = useTranslation();
  const [step, setStep] = useState('request');
  const [otp, setOtp] = useState('');
  const [otpType, setOtpType] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const handleRequest = async () => {
    setSending(true);
    setError('');
    try {
      const res = await languageAPI.request(targetLang);
      setOtpType(res.data.type);
      setStep('verify');
      setResendCountdown(Math.ceil((res.data?.retryAfterMs || 0) / 1000) || RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to send OTP';
      const retryAfterMs = err.response?.data?.retryAfterMs;
      if (retryAfterMs) {
        setResendCountdown(Math.ceil(retryAfterMs / 1000));
      } else {
        setError(msg);
      }
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResending(true);
    try {
      const res = await languageAPI.request(targetLang);
      const retryAfterSec = Math.ceil((res.data?.retryAfterMs || 0) / 1000);
      setResendCountdown(retryAfterSec > 0 ? retryAfterSec : RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const retryAfterMs = err.response?.data?.retryAfterMs;
      if (retryAfterMs) {
        setResendCountdown(Math.ceil(retryAfterMs / 1000));
      } else {
        setError(err.response?.data?.error || 'Unable to resend OTP. Please try again.');
        setResendCountdown(RESEND_COOLDOWN_SECONDS);
      }
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setVerifying(true);
    setError('');
    try {
      const res = await languageAPI.verify(targetLang, otp);
      if (onVerified) onVerified(targetLang, res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg text-surface-900">{t('language.verify.title')}</h3>
          <button className="touch-btn rounded-xl text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-surface-500">
          {t('language.verify.subtitle', { language: LANG_LABELS[targetLang] || targetLang })}
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3.5 rounded-xl border border-red-200 flex items-start gap-2 animate-slide-down">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
          </div>
        )}

        {step === 'request' ? (
          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={onClose}>{t('common.cancel')}</button>
            <button className="btn-primary flex-1" onClick={handleRequest} disabled={sending}>
              {sending ? (
                <><Loader2 size={16} className="animate-spin mr-1.5" /> {t('language.verify.sending')}</>
              ) : (
                <><Send size={16} className="mr-1.5" /> {t('common.verify', 'Send OTP')}</>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`flex items-center gap-2.5 p-3 rounded-xl text-sm ${otpType === 'email' ? 'bg-primary-50 text-primary-700 border border-primary-200' : 'bg-surface-50 text-surface-700 border border-surface-200'}`}>
              {otpType === 'email' ? <Mail size={16} /> : <Phone size={16} />}
              <span>{otpType === 'email' ? t('language.verify.emailOTP') : t('language.verify.phoneOTP')}</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('language.verify.otp')}</label>
              <div className="relative">
                <input
                  type="text"
                  className="input-field text-center text-lg tracking-[8px]"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={t('language.verify.otpPlaceholder')}
                  maxLength={6}
                  autoFocus
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleResend}
              disabled={resendCountdown > 0 || resending}
              className="w-full text-sm font-medium text-primary-600 hover:text-primary-700 disabled:text-surface-400 transition-colors"
            >
              {resending ? (
                <Loader2 size={14} className="animate-spin inline mr-1.5" />
              ) : null}
              {resendCountdown > 0
                ? `${t('language.verify.resendIn')} ${resendCountdown}s`
                : t('language.verify.resend')}
            </button>

            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={onClose}>{t('common.cancel')}</button>
              <button className="btn-primary flex-1" onClick={handleVerify} disabled={otp.length !== 6 || verifying}>
                {verifying ? (
                  <><Loader2 size={16} className="animate-spin mr-1.5" /> {t('language.verify.verifying')}</>
                ) : (
                  <>{t('language.verify.verify')}</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
