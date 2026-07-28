import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/I18nContext';

export default function SubscriptionSuccessPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [countdown, setCountdown] = useState(5);
  const { t } = useTranslation();

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (countdown <= 0) {
      router.push('/subscription');
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md animate-fade-in">
        <div className="w-20 h-20 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto animate-scale-in">
          <CheckCircle size={44} className="text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-surface-900">Payment Successful!</h1>
          <p className="text-surface-500">
            Your subscription has been activated. Welcome to the premium community!
          </p>
        </div>
        <div className="card p-6 space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm text-surface-500">
            <Loader2 size={16} className="animate-spin text-primary-500" />
            Redirecting to your subscription dashboard in {countdown}s...
          </div>
          <button
            className="btn-primary w-full"
            onClick={() => router.push('/subscription')}
          >
            {t('subscription.dashboard')} <ArrowRight size={18} className="ml-2" />
          </button>
          <button
            className="btn-secondary w-full"
            onClick={() => router.push('/')}
          >
            Back to Feed
          </button>
        </div>
      </div>
    </div>
  );
}