import React, { useState } from 'react';
import { X, Loader2, Send, AlertCircle, Mail, Phone } from 'lucide-react';
import { languageAPI } from '../utils/api';
import { useTranslation } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { sendPhoneOtp } from '../utils/firebaseClient';

const LANG_LABELS = { en: 'English', es: 'Spanish', hi: 'Hindi', pt: 'Portuguese', zh: 'Chinese', fr: 'French' };

const FIREBASE_ERRORS = {
  'auth/invalid-phone-number': 'Phone number on your profile is invalid. Please update it.',
  'auth/missing-phone-number': 'No phone number on your profile. Please add one in your profile settings.',
  'auth/too-many-requests': 'Too many requests. Please wait a bit and try again.',
  'auth/operation-not-allowed': 'Phone sign-in is not enabled in your Firebase project.',
  'auth/quota-exceeded': 'SMS quota exceeded. Please try again later.',
  'auth/network-request-failed': 'Network error while sending the SMS. Please try again.',
  'auth/captcha-check-failed': 'Verification failed. Please try again.',
  'auth/missing-app-credential': 'Verification failed. Please try again.',
  'auth/internal-error': 'Something went wrong. Please try again.',
};

function firebaseErrorMessage(err) {
  if (!err) return 'Failed to send OTP';
  const mapped = FIREBASE_ERRORS[err.code];
  if (mapped) return mapped;
  return err.message || 'Failed to send OTP';
}

export default function LanguageVerifyModal({ targetLang, onClose, onVerified }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [step, setStep] = useState('request');
  const [otp, setOtp] = useState('');
  const [channel, setChannel] = useState(null);
  const [verificationId, setVerificationId] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleRequest = async () => {
    setSending(true);
    setError('');
    try {
      const res = await languageAPI.request(targetLang);
      const chan = res.data.type === 'phone' ? 'phone' : 'email';
      setChannel(chan);

      if (chan === 'phone') {
        if (!user?.phone) {
          setError('No phone number on your profile. Please add one in your profile settings.');
          return;
        }
        const confirmationResult = await sendPhoneOtp(user.phone, 'recaptcha-container');
        setVerificationId(confirmationResult.verificationId);
      }

      setStep('verify');
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setVerifying(true);
    setError('');
    try {
      const payload = channel === 'phone'
        ? { verificationId, code: otp }
        : { otp };
      const res = await languageAPI.verify(targetLang, payload);
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
            <div className={`flex items-center gap-2.5 p-3 rounded-xl text-sm ${channel === 'email' ? 'bg-primary-50 text-primary-700 border border-primary-200' : 'bg-surface-50 text-surface-700 border border-surface-200'}`}>
              {channel === 'email' ? <Mail size={16} /> : <Phone size={16} />}
              <span>{channel === 'email' ? t('language.verify.emailOTP') : t('language.verify.phoneOTP')}</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('language.verify.otp')}</label>
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

        <div id="recaptcha-container" className="hidden" />
      </div>
    </div>
  );
}
