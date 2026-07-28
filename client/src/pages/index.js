import React from 'react';
import { useRouter } from 'next/router';
import { Code2, TrendingUp, Users, Sparkles, ArrowRight } from 'lucide-react';
import FeedContainer from '../components/FeedContainer';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const { hashtag } = router.query;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-10 animate-fade-in">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-700 to-surface-900 p-1">
          <div className="relative rounded-[calc(1.5rem-4px)] bg-white p-6 sm:p-12 md:p-16 text-center">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary-100/50 to-transparent rounded-bl-full" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-accent-100/50 to-transparent rounded-tr-full" />

            <div className="relative space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-sm font-medium">
                <Sparkles size={16} />
                Developer Community Platform
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-surface-900 leading-tight text-balance">
                Where{' '}
                <span className="bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                  developers
                </span>{' '}
                share, learn, and{' '}
                <span className="bg-gradient-to-r from-accent-500 to-primary-500 bg-clip-text text-transparent">
                  grow
                </span>{' '}
                together
              </h1>

              <p className="text-surface-500 max-w-lg mx-auto text-base sm:text-lg leading-relaxed">
                Share technical updates, showcase your projects, and connect with fellow developers
                who are passionate about building amazing things.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <a href="/register" className="btn-primary text-base shadow-lg shadow-primary-500/20">
                  {t('nav.getStarted')}
                  <ArrowRight size={18} className="ml-2" />
                </a>
                <a href="/trending" className="btn-secondary text-base">
                  <TrendingUp size={18} className="mr-2" />
                  {t('nav.trending')}
                </a>
              </div>

              <div className="flex items-center justify-center gap-6 pt-4 text-sm text-surface-400">
                <span className="flex items-center gap-1.5">
                  <Users size={16} className="text-primary-500" />
                  Community driven
                </span>
                <span className="flex items-center gap-1.5">
                  <Code2 size={16} className="text-accent-500" />
                  Dev focused
                </span>
                <span className="flex items-center gap-1.5">
                  <Sparkles size={16} className="text-amber-500" />
                  Real-time feed
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-surface-900">{t('nav.trending')}</h2>
            <a href="/trending" className="btn-ghost text-sm text-primary-600">
              {t('common.viewAll')} <ArrowRight size={16} className="ml-1" />
            </a>
          </div>
          <FeedContainer type="trending" limit={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <FeedContainer type="personalized" hashtag={hashtag || ''} limit={10} />
    </div>
  );
}
