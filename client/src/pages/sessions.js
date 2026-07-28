import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Shield, Smartphone, Monitor, Globe, Clock, Calendar, CheckCircle, XCircle, ArrowLeft, Loader2, Trash2, AlertTriangle, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';
import { sessionAPI } from '../utils/api';

export default function SessionsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const [message, setMessage] = useState('');

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await sessionAPI.getActiveSessions();
      setSessions(response.data.sessions);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) fetchSessions();
  }, [authLoading, isAuthenticated, router, fetchSessions]);

  const handleRevoke = async (sessionId) => {
    setRevoking(true);
    try {
      await sessionAPI.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      setRevokeTarget(null);
      setMessage('Session revoked successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to revoke session');
    } finally {
      setRevoking(false);
    }
  };

  const handleRevokeAll = async () => {
    setRevoking(true);
    try {
      await sessionAPI.revokeAllSessions();
      setSessions((prev) => prev.filter((s) => s.sessionId === (sessions.find(s2 => s2.isCurrent)?.sessionId)));
      setMessage('All other sessions revoked');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to revoke sessions');
    } finally {
      setRevoking(false);
    }
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(date);
  };

  const getDeviceIcon = (type) => {
    if (type === 'mobile') return Smartphone;
    if (type === 'tablet') return Monitor;
    return Monitor;
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
      <div className="flex items-center justify-between">
        <div>
          <a href={`/profile/${user?.username}`} className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-600 mb-3 transition-colors">
            <ArrowLeft size={16} />
            {t('common.goBack')}
          </a>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2.5">
            <Shield size={24} className="text-primary-500" />
            {t('sessions.title')}
          </h1>
          <p className="text-sm text-surface-500 mt-1">{t('sessions.subtitle')}</p>
        </div>
      </div>

      {message && (
        <div className="bg-emerald-50 text-emerald-700 text-sm p-3.5 rounded-xl border border-emerald-200 flex items-center gap-2 animate-slide-down">
          <CheckCircle size={16} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3.5 rounded-xl border border-red-200 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="card p-12 text-center">
          <Loader2 size={24} className="animate-spin text-surface-400 mx-auto" />
          <p className="text-sm text-surface-400 mt-3">{t('common.loading')}</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="card p-12 text-center">
          <Shield size={32} className="mx-auto text-surface-300" />
          <p className="text-surface-500 font-medium mt-3">No active sessions</p>
          <p className="text-sm text-surface-400 mt-1">All your sessions have expired or were revoked.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-surface-500">{sessions.length} active session{sessions.length > 1 ? 's' : ''}</p>
            {sessions.length > 1 && (
              <button
                className="btn-ghost text-sm text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={handleRevokeAll}
                disabled={revoking}
              >
                <LogOut size={14} className="mr-1.5" />
                {t('sessions.revokeAll')}
              </button>
            )}
          </div>

          {sessions.map((session) => {
            const DeviceIcon = getDeviceIcon(session.deviceType);
            const isCurrent = session.sessionId === (sessions.length > 0 && sessions[0].sessionId);

            return (
              <div key={session._id} className={`card p-4 sm:p-5 space-y-3 transition-all ${isCurrent ? 'ring-2 ring-primary-200' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isCurrent ? 'bg-primary-100 text-primary-600' : 'bg-surface-100 text-surface-500'
                    }`}>
                      <DeviceIcon size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-surface-900 truncate">{session.browser}</p>
                        {isCurrent && (
                          <span className="text-[11px] font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">{t('sessions.current')}</span>
                        )}
                        {session.isTrusted && (
                          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{t('sessions.trusted')}</span>
                        )}
                      </div>
                      <p className="text-xs text-surface-400 mt-0.5">{session.os}</p>
                    </div>
                  </div>

                  {!isCurrent && (
                    <button
                      className="touch-btn rounded-xl text-surface-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                      onClick={() => setRevokeTarget(session.sessionId)}
                      title={t('sessions.revoke')}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-surface-400">
                  {session.ip && (
                    <span className="flex items-center gap-1">
                      <Globe size={12} />
                      {session.ip}
                    </span>
                  )}
                  {session.location?.raw && <span>{session.location.raw}</span>}
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {timeAgo(session.lastActiveAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {t('sessions.expires')} {formatDate(session.expiresAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {revokeTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-surface-900">{t('sessions.revokeConfirmTitle')}</h3>
                <p className="text-sm text-surface-500">{t('sessions.revokeConfirmMessage')}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button className="btn-secondary" onClick={() => setRevokeTarget(null)} disabled={revoking}>
                {t('common.cancel')}
              </button>
              <button className="btn-danger" onClick={() => handleRevoke(revokeTarget)} disabled={revoking}>
                {revoking ? <Loader2 size={16} className="animate-spin mr-1.5" /> : null}
                {t('sessions.revoke')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
