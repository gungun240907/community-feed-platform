import { useRouter } from 'next/router';
import { XCircle, ArrowLeft } from 'lucide-react';
import { useTranslation } from '../../context/I18nContext';

export default function SubscriptionCancelPage() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md animate-fade-in">
        <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
          <XCircle size={44} className="text-red-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-surface-900">Payment Canceled</h1>
          <p className="text-surface-500">
            Your payment was not processed. Your account remains on the Free plan. No charges were made.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            className="btn-primary"
            onClick={() => router.push('/pricing')}
          >
            {t('common.retry')}
          </button>
          <button
            className="btn-secondary"
            onClick={() => router.push('/')}
          >
            <ArrowLeft size={16} className="mr-1.5" /> Back to Feed
          </button>
        </div>
      </div>
    </div>
  );
}