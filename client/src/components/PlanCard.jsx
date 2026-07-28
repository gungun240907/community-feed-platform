import { Check, Crown, Zap, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';

const planStyles = {
  bronze: {
    gradient: 'from-amber-600 to-amber-800',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-700',
    icon: Crown,
    badge: 'bg-amber-500',
    shadow: 'shadow-amber-500/20',
  },
  silver: {
    gradient: 'from-slate-400 to-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-300',
    text: 'text-slate-700',
    icon: Zap,
    badge: 'bg-slate-500',
    shadow: 'shadow-slate-500/20',
  },
  gold: {
    gradient: 'from-yellow-400 to-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    text: 'text-yellow-700',
    icon: Sparkles,
    badge: 'bg-yellow-500',
    shadow: 'shadow-yellow-500/20',
  },
};

export default function PlanCard({ plan, name, price, priceLabel, features, isCurrentPlan, onSelect, isLoading }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const styles = planStyles[plan];

  const Icon = styles?.icon || Crown;

  if (plan === 'free') {
    return (
      <div className={`relative card p-6 sm:p-8 flex flex-col transition-all duration-200 ${isCurrentPlan ? 'ring-2 ring-primary-500 shadow-lg' : 'hover:shadow-md'}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center">
            <span className="text-surface-500 font-bold text-lg">F</span>
          </div>
          <div>
            <h3 className="font-bold text-lg text-surface-900">{t('pricing.free')}</h3>
            <p className="text-sm text-surface-400">{t('nav.getStarted')}</p>
          </div>
        </div>

        <div className="mb-6">
          <span className="text-3xl font-bold text-surface-900">₹0</span>
          <span className="text-surface-400 text-sm ml-1">/month</span>
        </div>

        <ul className="space-y-3 flex-1">
          <li className="flex items-start gap-2.5 text-sm text-surface-600">
            <Check size={16} className="mt-0.5 flex-shrink-0 text-surface-400" />
            <span>1 question per day</span>
          </li>
          <li className="flex items-start gap-2.5 text-sm text-surface-600">
            <Check size={16} className="mt-0.5 flex-shrink-0 text-surface-400" />
            <span>Basic search only</span>
          </li>
          <li className="flex items-start gap-2.5 text-sm text-surface-600">
            <Check size={16} className="mt-0.5 flex-shrink-0 text-surface-400" />
            <span>Standard bookmarks</span>
          </li>
          <li className="flex items-start gap-2.5 text-sm text-surface-400">
            <Check size={16} className="mt-0.5 flex-shrink-0 text-surface-300" />
            <span>No profile badge</span>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div className={`relative card p-6 sm:p-8 flex flex-col transition-all duration-200 ${isCurrentPlan ? 'ring-2 ring-primary-500 shadow-lg' : 'hover:shadow-md'} overflow-hidden`}>
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${styles.gradient}`} />

      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 rounded-xl ${styles.bg} flex items-center justify-center`}>
          <Icon size={20} className={styles.text} />
        </div>
        <div>
          <h3 className="font-bold text-lg text-surface-900">{name}</h3>
          <p className="text-sm text-surface-400">Premium plan</p>
        </div>
      </div>

      <div className="mb-6">
        <span className="text-3xl font-bold text-surface-900">{priceLabel || `₹${price}`}</span>
        <span className="text-surface-400 text-sm ml-1">/month</span>
      </div>

      <ul className="space-y-3 flex-1">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-surface-600">
            <Check size={16} className="mt-0.5 flex-shrink-0 text-emerald-500" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {isCurrentPlan ? (
          <div className="w-full py-2.5 rounded-xl bg-primary-50 text-primary-700 font-semibold text-sm text-center border border-primary-200">
            {t('subscription.current')}
          </div>
        ) : (
          <button
            className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
              isLoading ? 'opacity-70 cursor-not-allowed bg-primary-600 text-white' : 'btn-primary shadow-lg'
            }`}
            onClick={onSelect}
            disabled={isLoading}
          >
            {isLoading ? (
              <><Loader2 size={16} className="animate-spin" /> {t('subscription.processing')}</>
            ) : (
              t('subscription.upgrade')
            )}
          </button>
        )}
      </div>
    </div>
  );
}