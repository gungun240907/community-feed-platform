import React from 'react';
import { Flame, TrendingUp, ArrowRight } from 'lucide-react';
import FeedContainer from '../components/FeedContainer';
import { useTranslation } from '../context/I18nContext';

export default function TrendingPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent-500 via-accent-600 to-primary-600 p-1">
        <div className="rounded-[calc(1rem-4px)] bg-white p-6 sm:p-8">
          <div className="flex items-start sm:items-center gap-4 sm:gap-6">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-accent-100 to-primary-100 flex items-center justify-center flex-shrink-0">
              <Flame size={28} className="text-accent-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-surface-900">{t('nav.trending')}</h1>
              <p className="text-sm text-surface-500 mt-1">
                Top engaged posts powered by our engagement algorithm. New content rises as it gains traction.
              </p>
            </div>
          </div>
        </div>
      </div>

      <FeedContainer type="trending" limit={20} />
    </div>
  );
}
