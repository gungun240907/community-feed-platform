import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../context/I18nContext';
import { useRouter } from 'next/router';
import { Loader2, CreditCard, Calendar, ArrowLeft, Download, Ban, RefreshCw, CheckCircle, XCircle, Crown, Zap, Sparkles, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscriptionAPI } from '../utils/api';
import ProfileBadge from '../components/ProfileBadge';

const planMeta = {
  bronze: { label: 'Bronze', gradient: 'from-amber-500 to-amber-700', icon: Crown },
  silver: { label: 'Silver', gradient: 'from-slate-400 to-slate-600', icon: Zap },
  gold: { label: 'Gold', gradient: 'from-yellow-400 to-yellow-600', icon: Sparkles },
};

export default function SubscriptionPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [planConfig, setPlanConfig] = useState(null);
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const { t } = useTranslation();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [subRes, payRes] = await Promise.all([
        subscriptionAPI.getStatus(),
        subscriptionAPI.getPayments(),
      ]);
      setSubscription(subRes.data.subscription);
      setPlanConfig(subRes.data.plan);
      setPayments(payRes.data.payments || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load subscription data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, authLoading, router, fetchData]);

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will retain access until the end of the billing period.')) return;
    setActionLoading('cancel');
    try {
      await subscriptionAPI.cancel();
      await fetchData();
    } catch (err) {
      console.error('Cancel failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadInvoice = (payment) => {
    const win = window.open('', '_blank');
    const planLabel = payment.plan.charAt(0).toUpperCase() + payment.plan.slice(1);
    win.document.write(`
      <html><head><title>Invoice ${payment.invoiceNumber || payment._id.slice(-8)}</title>
      <style>
        body { font-family: -apple-system, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #1f2937; }
        .header { border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #6366f1; margin: 0; font-size: 28px; }
        .header p { color: #6b7280; margin: 4px 0 0; }
        .details { margin-bottom: 30px; }
        .details table { width: 100%; border-collapse: collapse; }
        .details td { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .details td:last-child { text-align: right; font-weight: 600; }
        .total { font-size: 18px; margin-top: 20px; text-align: right; border-top: 2px solid #1f2937; padding-top: 12px; }
        .footer { margin-top: 40px; color: #9ca3af; font-size: 12px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; }
        @media print { body { margin: 20px; } .no-print { display: none; } }
        .no-print { text-align: center; margin-bottom: 30px; }
        .no-print button { background: #6366f1; color: white; border: 0; padding: 10px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; }
      </style></head><body>
      <div class="no-print"><button onclick="window.print()">Print / Save as PDF</button></div>
      <div class="header">
        <h1>DevFeed</h1>
        <p>Invoice #${payment.invoiceNumber || payment._id.slice(-8).toUpperCase()}</p>
      </div>
      <div class="details">
        <table>
          <tr><td>Invoice Date</td><td>${new Date(payment.paidAt || payment.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
          <tr><td>Plan</td><td>${planLabel}</td></tr>
          <tr><td>Amount</td><td>₹${payment.amount}</td></tr>
          <tr><td>Status</td><td style="color:#059669">Paid</td></tr>
          <tr><td>Payment ID</td><td style="font-family:monospace;font-size:13px">${payment.razorpayPaymentId || 'N/A'}</td></tr>
        </table>
      </div>
      <div class="total">Total: ₹${payment.amount}</div>
      <div class="footer">DevFeed Community Platform &mdash; Thank you for your support!</div>
      <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); }; </script>
      </body></html>
    `);
    win.document.close();
  };

  const handleReactivate = async () => {
    setActionLoading('reactivate');
    try {
      await subscriptionAPI.reactivate();
      await fetchData();
    } catch (err) {
      console.error('Reactivate failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const isPaid = subscription && subscription.plan !== 'free' && subscription.status === 'active';
  const meta = planMeta[subscription?.plan];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="touch-btn rounded-xl text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-all"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-surface-900">{t('subscription.dashboard')}</h1>
          <p className="text-sm text-surface-500">{t('subscription.subtitle')}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3.5 rounded-xl border border-red-200 flex items-center gap-2">
          <XCircle size={16} />
          <span>{error}</span>
          <button className="ml-auto btn-ghost text-xs" onClick={fetchData}>{t('common.retry')}</button>
        </div>
      )}

      {isPaid && meta && (
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${meta.gradient} p-1`}>
          <div className="rounded-[calc(1rem-4px)] bg-white p-6 sm:p-8">
            <div className="flex items-start sm:items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center shadow-lg flex-shrink-0`}>
                <meta.icon size={28} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-bold text-surface-900">{meta.label} Plan</h2>
                  <span className="badge-success text-xs">Active</span>
                </div>
                <p className="text-sm text-surface-500 mt-1">
                  {subscription.cancelAtPeriodEnd
                    ? `Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                    : `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                  }
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
              <div className="bg-surface-50 rounded-xl p-4 text-center">
                <p className="text-xs text-surface-400 uppercase tracking-wide">{t('subscription.status')}</p>
                <p className="font-semibold text-sm text-emerald-600 mt-1 capitalize">{subscription.status}</p>
              </div>
              <div className="bg-surface-50 rounded-xl p-4 text-center">
                <p className="text-xs text-surface-400 uppercase tracking-wide">{t('subscription.plan')}</p>
                <p className="font-semibold text-sm text-surface-900 mt-1">{meta.label}</p>
              </div>
              <div className="bg-surface-50 rounded-xl p-4 text-center">
                <p className="text-xs text-surface-400 uppercase tracking-wide">Auto-renew</p>
                <p className="font-semibold text-sm mt-1">{subscription.cancelAtPeriodEnd ? <span className="text-red-500">Off</span> : <span className="text-emerald-600">On</span>}</p>
              </div>
              <div className="bg-surface-50 rounded-xl p-4 text-center">
                <p className="text-xs text-surface-400 uppercase tracking-wide">Per Day</p>
                <p className="font-semibold text-sm text-surface-900 mt-1">{planConfig?.postsPerDay === -1 ? '∞' : planConfig?.postsPerDay || 0}</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              {subscription.cancelAtPeriodEnd ? (
                <button
                  className="btn-primary text-sm"
                  onClick={handleReactivate}
                  disabled={actionLoading === 'reactivate'}
                >
                  {actionLoading === 'reactivate' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} className="mr-1.5" />}
                  {t('subscription.reactivate')}
                </button>
              ) : (
                <button
                  className="btn-danger text-sm"
                  onClick={handleCancel}
                  disabled={actionLoading === 'cancel'}
                >
                  {actionLoading === 'cancel' ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} className="mr-1.5" />}
                  {t('subscription.cancel')}
                </button>
              )}
              <a href="/pricing" className="btn-secondary text-sm">
                <Crown size={16} className="mr-1.5" /> {t('subscription.upgrade')}
              </a>
            </div>
          </div>
        </div>
      )}

      {(!isPaid || !subscription || subscription.plan === 'free') && (
        <div className="card p-8 sm:p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto">
            <CreditCard size={28} className="text-surface-400" />
          </div>
          <div>
            <p className="text-surface-500 font-medium">{t('pricing.free')}</p>
            <p className="text-sm text-surface-400 mt-1">You are currently on the Free plan.</p>
          </div>
          <div className="bg-surface-50 rounded-xl p-4 max-w-sm mx-auto">
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <p className="font-bold text-surface-900">{planConfig?.postsPerDay || 1}</p>
                <p className="text-xs text-surface-400">Posts/day</p>
              </div>
              <div>
                <p className="font-bold text-surface-900 capitalize">{planConfig?.search || 'Basic'}</p>
                <p className="text-xs text-surface-400">{t('common.search')}</p>
              </div>
              <div>
                <p className="font-bold text-surface-900">{user?.badge ? 'Yes' : 'No'}</p>
                <p className="text-xs text-surface-400">Badge</p>
              </div>
            </div>
          </div>
          <a href="/pricing" className="btn-primary">
            <Crown size={16} className="mr-1.5" /> {t('subscription.upgrade')}
          </a>
        </div>
      )}

      {payments.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={18} className="text-primary-500" />
            <h2 className="font-semibold text-surface-900">{t('subscription.payments')}</h2>
          </div>
          <div className="space-y-3">
            {payments.map((payment) => (
              <div key={payment._id} className="flex items-center justify-between py-3 border-b border-surface-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${payment.status === 'succeeded' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    {payment.status === 'succeeded' ? <CheckCircle size={18} className="text-emerald-500" /> : <XCircle size={18} className="text-red-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-900 capitalize">{payment.plan} Plan</p>
                    <p className="text-xs text-surface-400">{new Date(payment.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm text-surface-900">₹{payment.amount}</span>
                  <button
                    onClick={() => handleDownloadInvoice(payment)}
                    className="touch-btn text-xs text-primary-500 hover:text-primary-700 flex items-center gap-1"
                    title={payment.invoiceNumber ? `Invoice ${payment.invoiceNumber}` : 'Download Invoice'}
                  >
                    <FileText size={14} />
                    <span className="hidden sm:inline">Invoice</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}