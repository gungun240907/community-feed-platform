import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { MessageCircle, ArrowLeft, Loader2, Send, AlertCircle, CheckCircle, Crown, Zap, Clock, Check, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';
import { supportAPI } from '../utils/api';

export default function SupportPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [form, setForm] = useState({ subject: '', category: 'bug', message: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsPagination, setTicketsPagination] = useState(null);
  const [activeTab, setActiveTab] = useState('submit');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (activeTab === 'tickets') {
      fetchTickets();
    }
  }, [activeTab]);

  const fetchTickets = async (page = 1) => {
    setTicketsLoading(true);
    try {
      const res = await supportAPI.getMyTickets(page);
      setTickets(res.data.tickets);
      setTicketsPagination(res.data.pagination);
    } catch {
      setTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  };

  const plan = user?.subscriptionPlan || 'free';
  const isPriority = plan === 'silver' || plan === 'gold';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const res = await supportAPI.submit(form);
      setSuccess(res.data.message);
      setForm({ subject: '', category: 'bug', message: '' });
      fetchTickets();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit support ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="touch-btn rounded-xl text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-all"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
<h1 className="text-xl font-bold text-surface-900">{t('support.title')}</h1>
           <p className="text-sm text-surface-500">{t('support.subtitle')}</p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-accent-600 p-1">
        <div className="rounded-[calc(1rem-4px)] bg-white p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-sm">
              <MessageCircle size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-surface-900">{t('support.contact')}</p>
                {isPriority ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-medium">
                    <Zap size={10} /> {t('support.priority')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-100 text-surface-500 text-[10px] font-medium">
                    {t('support.standard')}
                  </span>
                )}
              </div>
              <p className="text-xs text-surface-400 mt-0.5">
{isPriority
                    ? t('support.priorityHint')
                    : t('support.standardHint')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex bg-surface-100 rounded-xl p-1">
        <button
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'submit' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
          }`}
          onClick={() => setActiveTab('submit')}
        >
          <Send size={15} className="inline mr-1.5" /> Submit
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'tickets' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
          }`}
          onClick={() => setActiveTab('tickets')}
        >
          <Clock size={15} className="inline mr-1.5" /> My Tickets
        </button>
      </div>

      {activeTab === 'submit' && (
      <>
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm animate-slide-down">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm animate-slide-down">
          <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('support.category')}</label>
          <select
            className="input-field"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option value="bug">{t('support.category.bug')}</option>
            <option value="feature">{t('support.category.feature')}</option>
            <option value="account">{t('support.category.account')}</option>
            <option value="other">{t('support.category.other')}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('support.subject')}</label>
          <input
            type="text"
            className="input-field"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder={t('support.subjectPlaceholder')}
            maxLength={200}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('support.message')}</label>
          <textarea
            className="input-field min-h-[140px] resize-y text-sm"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder={t('support.messagePlaceholder')}
            maxLength={5000}
            rows={5}
            required
          />
          <p className="text-xs text-surface-400 mt-1 text-right">{form.message.length}/5000</p>
        </div>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={isSubmitting || !form.subject.trim() || !form.message.trim()}
        >
          {isSubmitting ? (
            <><Loader2 size={16} className="animate-spin mr-1.5" /> {t('support.submitting')}</>
          ) : (
            <><Send size={16} className="mr-1.5" /> {t('support.submit')}</>
          )}
        </button>

        <p className="text-xs text-surface-400 text-center">
          {plan === 'free'
            ? t('support.rateFree')
            : t('support.ratePremium')}
        </p>
      </form>
      </>

      )}

      {activeTab === 'tickets' && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-surface-900">My Tickets</h3>
          {ticketsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-primary-600" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle size={32} className="mx-auto text-surface-300 mb-2" />
              <p className="text-sm text-surface-400">No tickets submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div key={ticket._id} className="p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-surface-400 uppercase tracking-wide">{ticket.category}</span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                      ticket.status === 'open'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {ticket.status === 'open' ? <Clock size={12} /> : <Check size={12} />}
                      {ticket.status === 'open' ? 'Open' : 'Closed'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-surface-900">{ticket.subject}</p>
                  <p className="text-xs text-surface-400 line-clamp-2">{ticket.message}</p>
                  <p className="text-[11px] text-surface-400">
                    {new Date(ticket.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
              ))}
              {ticketsPagination?.hasMore && (
                <button
                  className="btn-secondary w-full text-sm"
                  onClick={() => fetchTickets(ticketsPagination.page + 1)}
                >
                  Load More
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}