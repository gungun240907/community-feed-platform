import React, { useState } from 'react';
import { Code2, Home, Flame, LogIn, UserPlus, LogOut, Shield, Crown, Edit3, Sparkles, MessageCircle, AlertTriangle, X, Sun, Moon, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import NotificationBell from './NotificationBell';
import SearchBar from './SearchBar';
import LanguageSwitcher from './LanguageSwitcher';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <nav className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-surface-200/70 dark:bg-[#15202b]/80 dark:border-[#38444d]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all">
              <Code2 size={18} className="text-white" />
            </div>
            <span className="hidden sm:inline text-lg font-extrabold tracking-tight bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent">
              {t('app.name')}
            </span>
          </a>

          <div className="flex items-center gap-1 sm:gap-2">
            <a href="/" className="nav-link" aria-label={t('nav.home')}>
              <Home size={18} className="sm:mr-1.5" />
              <span className="hidden sm:inline">{t('nav.home')}</span>
            </a>
            <a href="/trending" className="nav-link" aria-label={t('nav.trending')}>
              <Flame size={18} className="sm:mr-1.5" />
              <span className="hidden sm:inline">{t('nav.trending')}</span>
            </a>
            <div className="hidden md:block"><SearchBar /></div>

            <button
              onClick={toggleTheme}
              className="nav-link !px-2.5"
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <LanguageSwitcher />

            {isAuthenticated ? (
              <>
                <NotificationBell />
                <a href="/pricing" className="nav-link !px-2.5" title="Premium" aria-label="Premium">
                  <Crown size={18} />
                </a>
                <a href="/edit-profile" className="nav-link !px-2.5" title={t('nav.editProfile')} aria-label={t('nav.editProfile')}>
                  <Edit3 size={18} />
                </a>
                {user?.subscriptionPlan === 'gold' && (
                  <a href="/gold" className="nav-link !px-2.5 text-yellow-500" title={t('nav.goldLounge')}>
                    <Sparkles size={18} />
                  </a>
                )}
                <a href="/support" className="nav-link !px-2.5" title={t('nav.support')}>
                  <MessageCircle size={18} />
                </a>
                {user?.role === 'admin' && (
                  <a href="/admin" className="nav-link !px-2.5" title={t('nav.admin')}>
                    <Shield size={18} />
                  </a>
                )}
                <div className="flex items-center gap-1.5 ml-1.5 pl-2.5 border-l border-surface-200 dark:border-[#38444d]">
                  <a href={`/profile/${user.username}`} className="flex items-center gap-2 nav-link !px-1.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      {(user.displayName || user.username)[0].toUpperCase()}
                    </div>
                    <span className="hidden lg:inline text-sm font-semibold max-w-[100px] truncate text-surface-700 dark:text-[#e7e9ea]">
                      {user.displayName || user.username}
                    </span>
                  </a>
                  <button
                    className="nav-link !px-2.5 text-surface-400 hover:text-red-500"
                    onClick={() => setShowLogoutConfirm(true)}
                    title={t('nav.logout')}
                    aria-label={t('nav.logout')}
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 ml-1.5 pl-2.5 border-l border-surface-200 dark:border-[#38444d]">
                <a href="/login" className="nav-link">
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
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
             onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-card rounded-3xl p-6 max-w-sm w-full shadow-float space-y-4 animate-scale-in dark:bg-[#1e2732] dark:border dark:border-[#38444d]"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center dark:bg-red-500/15">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-surface-900 dark:text-white">{t('nav.logout')}</h3>
                <p className="text-sm text-surface-500 dark:text-[#8b98a5]">{t('nav.logoutConfirm') || 'Are you sure you want to logout?'}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowLogoutConfirm(false)}>{t('common.cancel') || 'Cancel'}</button>
              <button className="btn-danger" onClick={() => { logout(); setShowLogoutConfirm(false); }}>
                <LogOut size={16} className="mr-1.5" /> {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
