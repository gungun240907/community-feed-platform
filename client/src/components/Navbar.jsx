import React from 'react';
import { Code2, Home, Flame, LogIn, UserPlus, LogOut, Shield, Crown, Edit3, Sparkles, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';
import NotificationBell from './NotificationBell';
import SearchBar from './SearchBar';
import LanguageSwitcher from './LanguageSwitcher';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-surface-200/80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <Code2 size={18} className="text-white" />
            </div>
            <span className="hidden sm:inline text-lg font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
              {t('app.name')}
            </span>
          </a>

          <div className="flex items-center gap-1 sm:gap-2">
            <a href="/" className="btn-ghost text-sm flex-shrink-0" aria-label={t('nav.home')}>
              <Home size={18} className="sm:mr-1.5" />
              <span className="hidden sm:inline">{t('nav.home')}</span>
            </a>
            <a href="/trending" className="btn-ghost text-sm flex-shrink-0" aria-label={t('nav.trending')}>
              <Flame size={18} className="sm:mr-1.5" />
              <span className="hidden sm:inline">{t('nav.trending')}</span>
            </a>
            <SearchBar />
            <LanguageSwitcher />

            {isAuthenticated ? (
              <>
                <NotificationBell />
                <a
                  href="/pricing"
                  className="btn-ghost text-sm"
                  title="Premium"
                  aria-label="Premium"
                >
                  <Crown size={18} />
                </a>
                <a
                  href="/edit-profile"
                  className="btn-ghost text-sm"
                  title={t('nav.editProfile')}
                  aria-label={t('nav.editProfile')}
                >
                  <Edit3 size={18} />
                </a>
                {user?.subscriptionPlan === 'gold' && (
                  <a href="/gold" className="btn-ghost text-sm text-yellow-600" title={t('nav.goldLounge')}>
                    <Sparkles size={18} />
                  </a>
                )}
                <a href="/support" className="btn-ghost text-sm" title={t('nav.support')}>
                  <MessageCircle size={18} />
                </a>
                {user?.role === 'admin' && (
                  <a href="/admin" className="btn-ghost text-sm" title={t('nav.admin')}>
                    <Shield size={18} />
                  </a>
                )}
                <div className="flex items-center gap-2 ml-2 pl-3 border-l border-surface-200">
                  <a
                    href={`/profile/${user.username}`}
                    className="flex items-center gap-2.5 btn-ghost text-sm"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      {(user.displayName || user.username)[0].toUpperCase()}
                    </div>
                    <span className="hidden sm:inline text-sm font-medium max-w-[100px] truncate text-surface-700">
                      {user.displayName || user.username}
                    </span>
                  </a>
                  <button
                    className="btn-ghost text-sm text-surface-400 hover:text-red-500"
                    onClick={logout}
                    title={t('nav.logout')}
                    aria-label={t('nav.logout')}
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 ml-2 pl-3 border-l border-surface-200">
                <a href="/login" className="btn-ghost text-sm">
                  <LogIn size={18} className="sm:mr-1.5" />
                  <span className="hidden sm:inline">{t('nav.signIn')}</span>
                </a>
                <a href="/register" className="btn-primary text-sm">
                  <UserPlus size={18} className="sm:mr-1.5" />
                  <span className="hidden sm:inline">{t('nav.getStarted')}</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
