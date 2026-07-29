import React, { useState } from 'react';
import { KeyRound, ArrowLeft, Loader2, Mail, Phone, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { authAPI } from '../utils/api';
import { useTranslation } from '../context/I18nContext';
import PhoneInput from '../components/PhoneInput';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [inputMethod, setInputMethod] = useState('email');
  const [step, setStep] = useState('form');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const payload = inputMethod === 'email'
        ? { email: email.trim() }
        : { phone: phone.trim() };

      const response = await authAPI.forgotPassword(payload);
      setNewPassword(response.data.newPassword);
      setStep('success');
    } catch (err) {
      const msg = err.response?.data?.error || 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-sm animate-slide-up">
        <a href="/login" className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-600 mb-6 transition-colors">
          <ArrowLeft size={16} />
          {t('common.goBack')}
        </a>

        {step === 'form' && (
          <div className="card p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mx-auto shadow-lg shadow-primary-500/20">
                <KeyRound size={22} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-surface-900">{t('auth.forgotPassword.title')}</h1>
              <p className="text-sm text-surface-500">
                {t('auth.forgotPassword.subtitle')}
              </p>
            </div>

            {error && (
              <div className={`text-sm p-3.5 rounded-xl border flex items-start gap-2 animate-slide-down ${
                error.includes('one time per day')
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-red-50 text-red-600 border-red-200'
              }`}>
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex bg-surface-100 rounded-xl p-1">
              <button
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  inputMethod === 'email' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
                }`}
                onClick={() => setInputMethod('email')}
              >
                <Mail size={15} className="inline mr-1.5" /> {t('auth.register.email')}
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  inputMethod === 'phone' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
                }`}
                onClick={() => setInputMethod('phone')}
              >
                <Phone size={15} className="inline mr-1.5" /> {t('auth.register.phone')}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-surface-700">
                  {inputMethod === 'email' ? t('auth.register.email') : t('auth.register.phone')}
                </label>
                {inputMethod === 'email' ? (
                  <input
                    type="email"
                    className="input-field"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                ) : (
                  <PhoneInput
                    value={phone}
                    onChange={(val) => setPhone(val)}
                    placeholder="Enter phone number"
                  />
                )}
              </div>

              <button
                type="submit"
                className="btn-primary w-full mt-2"
                disabled={isSubmitting || (inputMethod === 'email' ? !email.trim() : !phone.trim())}
              >
                {isSubmitting ? (
                  <Loader2 size={18} className="animate-spin mr-2" />
                ) : null}
                {t('auth.forgotPassword.button')}
              </button>
            </form>

            <p className="text-xs text-surface-400 text-center">
              {t('auth.forgotPassword.dayLimit')}
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="card p-6 sm:p-8 space-y-6 animate-fade-in">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle size={22} className="text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-surface-900">{t('auth.forgotPassword.title')}</h1>
              <p className="text-sm text-surface-500">
                {t('auth.forgotPassword.successDescription')}
              </p>
            </div>

            <div className="bg-surface-50 rounded-xl p-4 border border-surface-200 space-y-3">
              <div className="text-xs text-surface-500 font-medium uppercase tracking-wide">New Password</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-lg font-mono font-bold text-primary-700 bg-white rounded-lg px-3 py-2.5 border border-surface-200 select-all break-all">
                  {newPassword}
                </code>
                <button
                  className="touch-btn rounded-xl text-surface-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
                  onClick={handleCopy}
                  title="Copy password"
                >
                  {copied ? <CheckCircle size={18} className="text-emerald-500" /> : <Copy size={18} />}
                </button>
              </div>
              <p className="text-xs text-surface-400">
                This password contains only letters (A-Z, a-z) for simplicity. You can change it after signing in.
              </p>
            </div>

            <a href="/login" className="btn-primary w-full justify-center">
              {t('auth.login.button')}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
