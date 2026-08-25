import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { UserPlus, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';
import PhoneInput from '../components/PhoneInput';

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { register, isAuthenticated } = useAuth();
  const [form, setForm] = useState({ username: '', email: '', password: '', displayName: '', phone: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.phone || form.phone.trim().length < 7) {
      setError('A valid phone number is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      await register(form);
      router.push('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-sm animate-slide-up">
        <a href="/" className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-600 mb-6 transition-colors">
          <ArrowLeft size={16} />
          {t('common.backToHome')}
        </a>

        <div className="card p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-500 to-primary-500 flex items-center justify-center mx-auto shadow-lg shadow-accent-500/20">
              <UserPlus size={22} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-surface-900">{t('auth.register.title')}</h1>
            <p className="text-sm text-surface-500">{t('auth.register.subtitle')}</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3.5 rounded-xl border border-red-200 animate-slide-down flex items-start gap-2">
              <span className="mt-0.5">•</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">{t('auth.register.username')}</label>
              <input
                type="text"
                className="input-field"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="johndoe"
                required
                minLength={3}
                maxLength={30}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">
                {t('auth.register.displayName')} <span className="text-surface-400 font-normal">{t('auth.register.displayNameOptional')}</span>
              </label>
              <input
                type="text"
                className="input-field"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="John Doe"
                maxLength={50}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">{t('auth.register.email')}</label>
              <input
                type="email"
                className="input-field"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">
                {t('auth.register.phone')} <span className="text-surface-400 font-normal">(required)</span>
              </label>
              <PhoneInput
                value={form.phone}
                onChange={(val) => setForm({ ...form, phone: val })}
                placeholder="Enter phone number"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">{t('auth.register.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pr-11"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={t('auth.register.passwordHint')}
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
              disabled={isSubmitting || !form.username || !form.email || !form.password || !form.phone}
            >
              {isSubmitting ? (
                <Loader2 size={18} className="animate-spin mr-2" />
              ) : null}
              {t('auth.register.button')}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-surface-400">{t('auth.register.hasAccount')}</span>
            </div>
          </div>

          <a
            href="/login"
            className="btn-secondary w-full justify-center"
          >
            {t('auth.login.button')}
          </a>
        </div>
      </div>
    </div>
  );
}
