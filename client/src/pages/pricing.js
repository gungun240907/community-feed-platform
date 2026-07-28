import { useState, useEffect } from 'react';
import { useTranslation } from '../context/I18nContext';
import { useRouter } from 'next/router';
import { Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscriptionAPI } from '../utils/api';
import PlanCard from '../components/PlanCard';

const plans = [
  {
    key: 'free',
    name: 'Free',
    price: 0,
    isFree: true,
    features: [
      '1 post per day',
      'Basic search',
      'Standard bookmarks',
      'No profile badge',
    ],
  },
  {
    key: 'bronze',
    name: 'Bronze',
    price: 99,
    features: [
      '5 posts per day',
      'Bronze profile badge',
      'Advanced search',
      'Standard bookmarks',
      'Standard support',
    ],
  },
  {
    key: 'silver',
    name: 'Silver',
    price: 299,
    popular: true,
    features: [
      '15 posts per day',
      'Silver profile badge',
      'Advanced search',
      'Unlimited bookmarks',
      'Priority support',
      'Enhanced profile visibility',
    ],
  },
  {
    key: 'gold',
    name: 'Gold',
    price: 999,
    features: [
      'Unlimited posts',
      'Gold profile badge',
      'Highest search priority',
      'Featured profile visibility',
      'Priority customer support',
      'Exclusive community features',
    ],
  },
];

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PricingPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [currentPlan, setCurrentPlan] = useState('free');
  const [loadingPlan, setLoadingPlan] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (user?.subscriptionPlan) {
      setCurrentPlan(user.subscriptionPlan);
    }
  }, [user, isAuthenticated, authLoading, router]);

  const handleSelectPlan = async (plan) => {
    if (plan === 'free') return;
    setLoadingPlan(plan);
    try {
      const res = await subscriptionAPI.createSubscription(plan);
      const data = res.data;

      // Dev mode: subscription activated without payment gateway
      if (data.subscription) {
        window.location.href = '/subscription?activated=true';
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded) {
        alert('Failed to load payment gateway. Please try again.');
        return;
      }

      const options = {
        key: data.key_id,
        order_id: data.order_id,
        name: 'Community Feed',
        description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan - ₹${data.amount / 100}/mo`,
        prefill: {
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: { color: '#4f46e5' },
        handler: async function (response) {
          try {
            await subscriptionAPI.verifyPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              plan,
            });
            window.location.href = '/subscription/success';
          } catch (err) {
            console.error('Payment verification failed:', err);
            alert(err.response?.data?.error || 'Payment verification failed. Please contact support.');
          }
        },
        modal: {
          ondismiss: function () {
            setLoadingPlan(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        alert(response.error?.description || 'Payment failed. Please try again.');
        setLoadingPlan(null);
      });
      rzp.open();
    } catch (err) {
      console.error('Failed to create subscription:', err);
      alert(err.response?.data?.error || 'Failed to process request');
      setLoadingPlan(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-sm font-medium">
          <CheckCircle size={16} />
          {t('subscription.title')}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-surface-900">
          {t('subscription.subtitle')}
        </h1>
        <p className="text-surface-500 max-w-lg mx-auto">
          {t('subscription.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {plans.map((plan) => (
          <PlanCard
            key={plan.key}
            plan={plan.key}
            name={plan.name}
            price={plan.price}
            features={plan.features}
            isCurrentPlan={currentPlan === plan.key}
            onSelect={() => handleSelectPlan(plan.key)}
            isLoading={loadingPlan === plan.key}
          />
        ))}
      </div>

      <div className="text-center text-sm text-surface-400 pt-4">
        <p>{t('subscription.guarantee')}</p>
        <p className="mt-1">
          {t('subscription.alreadySubscribed')}{' '}
          <a href="/subscription" className="text-primary-600 hover:text-primary-700 font-medium">
            {t('subscription.viewSubscription')}
          </a>
        </p>
      </div>
    </div>
  );
}
