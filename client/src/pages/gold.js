import React, { useState, useEffect } from 'react';
import { useTranslation } from '../context/I18nContext';
import { useRouter } from 'next/router';
import { Sparkles, Crown, Loader2, ArrowLeft, Shield, Users, MessageCircle, FileText, Zap, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/PostCard';
import { feedAPI } from '../utils/api';

export default function GoldLoungePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [goldPosts, setGoldPosts] = useState([]);
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.subscriptionPlan !== 'gold')) {
      router.replace('/pricing');
      return;
    }
  }, [isAuthenticated, authLoading, user, router]);

  useEffect(() => {
    if (user?.subscriptionPlan === 'gold') {
      feedAPI.getTrending(10)
        .then((res) => setGoldPosts(res.data.posts || []))
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 p-1">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-bl-full" />
        <div className="relative rounded-[calc(1rem-4px)] bg-white p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/30">
              <Crown size={28} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-surface-900">{t('goldLounge.title')}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-[10px] font-bold shadow-sm">
                  {t('goldLounge.exclusive')}
                </span>
              </div>
              <p className="text-sm text-surface-500 mt-1">
                {t('goldLounge.welcome', { name: user.displayName || user.username })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: t('goldLounge.unlimited'), value: '∞', icon: FileText, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: t('goldLounge.badge'), value: 'Active', icon: Crown, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: t('goldLounge.featured'), value: 'Enabled', icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: t('goldLounge.support'), value: '24/7', icon: Shield, color: 'text-yellow-600', bg: 'bg-yellow-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-4 sm:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon size={20} className={color} />
              </div>
              <div>
                <p className="text-lg sm:text-xl font-bold text-surface-900">{value}</p>
                <p className="text-xs text-surface-500">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-yellow-500" />
          <h2 className="font-semibold text-surface-900">{t('goldLounge.betaFeatures')}</h2>
        </div>
        <p className="text-sm text-surface-500">
          {t('goldLounge.betaHint')}
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-surface-50 border border-surface-200">
            <div>
              <p className="text-sm font-medium text-surface-900">{t('goldLounge.compactView')}</p>
              <p className="text-xs text-surface-400 mt-0.5">{t('goldLounge.compactHint')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer"
                checked={typeof window !== 'undefined' && localStorage.getItem('beta_compact') === 'true'}
                onChange={(e) => localStorage.setItem('beta_compact', e.target.checked)}
              />
              <div className="w-10 h-6 bg-surface-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500" />
            </label>
          </div>
          <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-surface-50 border border-surface-200">
            <div>
              <p className="text-sm font-medium text-surface-900">{t('goldLounge.enhancedNotifs')}</p>
              <p className="text-xs text-surface-400 mt-0.5">{t('goldLounge.enhancedHint')}</p>
            </div>
            <span className="text-xs text-surface-400 bg-surface-200 px-2 py-1 rounded-md">{t('goldLounge.comingSoon')}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2">
          <MessageCircle size={18} className="text-yellow-500" />
          {t('goldLounge.communityPosts')}
        </h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-surface-400" />
          </div>
        ) : goldPosts.length > 0 ? (
          <div className="space-y-4">
            {goldPosts.map((post) => (
              <PostCard key={post._id} post={post} />
            ))}
          </div>
        ) : (
          <div className="card p-12 text-center space-y-3">
            <MessageCircle size={32} className="mx-auto text-surface-300" />
            <p className="text-surface-500 font-medium">{t('goldLounge.welcomeMessage')}</p>
            <p className="text-sm text-surface-400">{t('goldLounge.welcomeHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}