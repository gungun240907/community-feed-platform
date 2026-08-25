import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { LogIn, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { login, isAuthenticated } = useAuth();
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await login(form);
      if (response && response.token) {
        router.push('/');
      } else {
        setError('Login failed. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
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
                placeholder="username, email or phone"
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
