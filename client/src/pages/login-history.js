import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { History, Smartphone, Monitor, Globe, Clock, CheckCircle, XCircle, ArrowLeft, Loader2, Inbox } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';
import { loginLogAPI } from '../utils/api';

export default function LoginHistoryPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const sentinelRef = useRef(null);

  const fetchLogs = useCallback(async (pageNum, append = false) => {
    setIsLoading(true);
    try {
      const response = await loginLogAPI.getHistory(pageNum, 20);
      const newLogs = response.data.logs;
      setLogs((prev) => (append ? [...prev, ...newLogs] : newLogs));
      setHasMore(response.data.pagination.hasMore);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load login history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) fetchLogs(1);
  }, [authLoading, isAuthenticated, router, fetchLogs]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  useEffect(() => {
    if (page > 1) fetchLogs(page, true);
  }, [page, fetchLogs]);

  const formatDate = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (days === 0) return `Today at ${timeStr}`;
    if (days === 1) return `Yesterday at ${timeStr}`;
    if (days < 7) return `${days} days ago at ${timeStr}`;
    return `${dateStr} ${timeStr}`;
  };

  const getDeviceIcon = (type) => {
    if (type === 'mobile') return Smartphone;
    if (type === 'tablet') return Monitor;
    return Monitor;
  };

  const methodLabels = {
    password: 'Password',
    otp: 'OTP Verified',
    trusted_device: 'Trusted Device',
  };

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-surface-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <a href={`/profile/${user?.username}`} className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-600 mb-3 transition-colors">
          <ArrowLeft size={16} />
          {t('common.goBack')}
        </a>
        <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2.5">
          <History size={24} className="text-primary-500" />
          {t('loginHistory.title')}
        </h1>
        <p className="text-sm text-surface-500 mt-1">{t('loginHistory.subtitle')}</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3.5 rounded-xl border border-red-200 flex items-start gap-2">
          <span>{error}</span>
        </div>
      )}

      {isLoading && logs.length === 0 ? (
        <div className="card p-12 text-center">
          <Loader2 size={24} className="animate-spin text-surface-400 mx-auto" />
          <p className="text-sm text-surface-400 mt-3">{t('common.loading')}</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="card p-12 text-center">
          <Inbox size={32} className="mx-auto text-surface-300" />
          <p className="text-surface-500 font-medium mt-3">{t('loginHistory.empty')}</p>
          <p className="text-sm text-surface-400 mt-1">{t('loginHistory.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const DeviceIcon = getDeviceIcon(log.deviceType);
            return (
              <div key={log._id} className="card p-4 sm:p-5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      log.success ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
                    }`}>
                      {log.success ? <CheckCircle size={18} /> : <XCircle size={18} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <DeviceIcon size={15} className="text-surface-400 flex-shrink-0" />
                        <p className="font-semibold text-sm text-surface-900 truncate">{log.browser}</p>
                      </div>
                      <p className="text-xs text-surface-400">{log.os}</p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    log.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {log.success ? 'Success' : 'Failed'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-surface-400">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatDate(log.createdAt)}
                  </span>
                  {log.ip && (
                    <span className="flex items-center gap-1">
                      <Globe size={12} />
                      {log.ip}
                    </span>
                  )}
                  {log.location?.raw && <span>{log.location.raw}</span>}
                  <span className="text-surface-400">· {methodLabels[log.method] || log.method}</span>
                  {log.failureReason && <span className="text-red-400">· {log.failureReason}</span>}
                </div>
              </div>
            );
          })}

          <div ref={sentinelRef} className="h-4" />
          {isLoading && logs.length > 0 && (
            <div className="flex justify-center py-4">
              <Loader2 size={20} className="animate-spin text-surface-400" />
            </div>
          )}
          {!hasMore && logs.length > 0 && (
            <p className="text-center text-sm text-surface-400 py-4">{t('profile.end')}</p>
          )}
        </div>
      )}
    </div>
  );
}
