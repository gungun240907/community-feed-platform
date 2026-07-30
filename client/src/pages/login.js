import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { LogIn, Loader2, Eye, EyeOff, ArrowLeft, Shield, Smartphone, Monitor, Globe, Wifi, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';
import { useOtp } from '../context/OtpContext';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { login, verifyLoginOtp, isAuthenticated } = useAuth();
  const { pendingOtp, subscribe } = useOtp();
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [requiresOtp, setRequiresOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [trustDevice, setTrustDevice] = useState(false);
  const [otpReceivedViaSocket, setOtpReceivedViaSocket] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!requiresOtp) return;
    const unsub = subscribe('login-page', (data) => {
      if (data.purpose === 'login_verification' && data.code) {
        setOtp(data.code);
        setOtpReceivedViaSocket(true);
        setTimeout(() => setOtpReceivedViaSocket(false), 3000);
      }
    });
    return unsub;
  }, [requiresOtp, subscribe]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await login(form);
      if (response && response.requiresOtp) {
        setDeviceInfo(response.deviceInfo);
        setRequiresOtp(true);
      } else {
        router.push('/');
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Please try again.';
      if (err.response?.data?.requiresOtp) {
        setDeviceInfo(err.response.data.deviceInfo);
        setRequiresOtp(true);
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setOtpError('');
    setOtpSubmitting(true);

    try {
      await verifyLoginOtp({ login: form.login, password: form.password, otp, trustDevice });
      router.push('/');
    } catch (err) {
      setOtpError(err.response?.data?.error || 'Invalid OTP. Please try again.');
    } finally {
      setOtpSubmitting(false);
    }
  };

  const deviceIcon = deviceInfo?.deviceType === 'mobile' ? Smartphone
    : deviceInfo?.deviceType === 'tablet' ? Monitor
    : Monitor;

  const DeviceIcon = deviceIcon;

  if (requiresOtp) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-sm animate-slide-up">
          <button onClick={() => setRequiresOtp(false)} className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-600 mb-6 transition-colors">
            <ArrowLeft size={16} />
            {t('common.goBack')}
          </button>

          <div className="card p-6 sm:p-8 space-y-6 relative">
            <button
              onClick={() => setRequiresOtp(false)}
              className="absolute top-4 right-4 touch-btn rounded-xl text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Close"
            >
              <X size={20} />
            </button>
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mx-auto shadow-lg shadow-primary-500/20">
                <Shield size={22} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-surface-900">{t('auth.login.verifyDevice')}</h1>
              <p className="text-sm text-surface-500">{t('auth.login.otpSent')}</p>
            </div>

            {deviceInfo && (
              <div className="bg-surface-50 rounded-xl p-4 border border-surface-200 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                    <DeviceIcon size={20} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-800">{deviceInfo.browser}</p>
                    <p className="text-xs text-surface-400">{deviceInfo.os}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-surface-400">
                  <Globe size={12} />
                  <span>{deviceInfo.ip}</span>
                  {deviceInfo.location && <span>· {deviceInfo.location}</span>}
                </div>
              </div>
            )}

            {otpError && (
              <div className="bg-red-50 text-red-600 text-sm p-3.5 rounded-xl border border-red-200 animate-slide-down flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>{otpError}</span>
              </div>
            )}

            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-surface-700">{t('auth.login.otpLabel')}</label>
                <div className="relative">
                  <input
                    type="text"
                    className="input-field text-center text-lg tracking-[8px]"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    required
                  />
                  {otpReceivedViaSocket && (
                    <div className="absolute -top-2 right-2 flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full border border-emerald-200 animate-slide-down">
                      <Wifi size={12} />
                      Real-time
                    </div>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                  trustDevice ? 'bg-primary-600 border-primary-600' : 'border-surface-300 group-hover:border-surface-400'
                }`}>
                  {trustDevice && <CheckCircle size={14} className="text-white" />}
                </div>
                <input
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  className="sr-only"
                />
                <span className="text-sm text-surface-600">{t('auth.login.trustDevice')}</span>
              </label>

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={otp.length !== 6 || otpSubmitting}
              >
                {otpSubmitting ? (
                  <Loader2 size={18} className="animate-spin mr-2" />
                ) : null}
                {t('auth.login.verifyButton')}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-sm animate-slide-up">
        <a href="/" className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-600 mb-6 transition-colors">
          <ArrowLeft size={16} />
          {t('common.backToHome')}
        </a>

        <div className="card p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mx-auto shadow-lg shadow-primary-500/20">
              <LogIn size={22} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-surface-900">{t('auth.login.title')}</h1>
            <p className="text-sm text-surface-500">{t('auth.login.subtitle')}</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3.5 rounded-xl border border-red-200 animate-slide-down flex items-start gap-2">
              <span className="mt-0.5">•</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">{t('auth.login.username')}</label>
              <input
                type="text"
                className="input-field"
                value={form.login}
                onChange={(e) => setForm({ ...form, login: e.target.value })}
                placeholder="username or email"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">{t('auth.login.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pr-11"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-1 top-1/2 -translate-y-1/2 touch-btn text-surface-400 hover:text-surface-600 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full mt-2"
              disabled={isSubmitting || !form.login || !form.password}
            >
              {isSubmitting ? (
                <Loader2 size={18} className="animate-spin mr-2" />
              ) : null}
              {t('auth.login.button')}
            </button>

            <div className="text-center">
              <a href="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors">
                {t('auth.login.forgotPassword')}
              </a>
            </div>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-surface-400">{t('auth.login.noAccount')}</span>
            </div>
          </div>

          <a
            href="/register"
            className="btn-secondary w-full justify-center"
          >
            {t('auth.register.button')}
          </a>
        </div>
      </div>
    </div>
  );
}
