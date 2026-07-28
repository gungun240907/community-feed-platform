import React, { useState, useEffect, useCallback } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Trash2, Ban, UserCheck, Eye, RefreshCw, Loader2, Users, FileText, Flag, UserX } from 'lucide-react';
import { adminAPI } from '../utils/api';
import { useTranslation } from '../context/I18nContext';

function ReportRow({ reportGroup, onAction }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const post = reportGroup.post;
  const author = post?.author || {};
  const reports = reportGroup.reports || [];

  const handleDismiss = async (reportId) => {
    setActionLoading('dismiss');
    try {
      await adminAPI.dismissReport(reportId);
      onAction();
    } catch (err) {
      console.error('Failed to dismiss report:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm(t('admin.deleteConfirm'))) return;
    setActionLoading('delete');
    try {
      await adminAPI.deletePost(post._id);
      onAction();
    } catch (err) {
      console.error('Failed to delete post:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspendUser = async () => {
    if (!window.confirm(t('admin.suspendConfirm', { username: author.username }))) return;
    setActionLoading('suspend');
    try {
      await adminAPI.suspendUser(author._id);
      onAction();
    } catch (err) {
      console.error('Failed to suspend user:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsuspendUser = async () => {
    if (!window.confirm(t('admin.unsuspendConfirm', { username: author.username }))) return;
    setActionLoading('unsuspend');
    try {
      await adminAPI.unsuspendUser(author._id);
      onAction();
    } catch (err) {
      console.error('Failed to unsuspend user:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const isLoading = actionLoading !== null;

  return (
    <div className="card overflow-hidden transition-all duration-200 hover:shadow-md">
      <div
        className="p-4 sm:p-6 flex items-start justify-between cursor-pointer hover:bg-surface-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm">
            {(author.displayName || author.username || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-surface-900">@{author.username}</span>
              <span className="badge-danger text-[11px]">
                {reportGroup.reportCount} report{reportGroup.reportCount > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-sm text-surface-500 mt-1.5 line-clamp-2 leading-relaxed">{post.content}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 ml-4">
          <button
            className="touch-btn rounded-xl text-surface-400 hover:text-red-500 hover:bg-red-50 transition-all"
            onClick={(e) => { e.stopPropagation(); handleDeletePost(); }}
            disabled={isLoading}
            title={t('admin.deletePost')}
          >
            {actionLoading === 'delete' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
          <button
            className="touch-btn rounded-xl text-surface-400 hover:text-orange-500 hover:bg-orange-50 transition-all"
            onClick={(e) => { e.stopPropagation(); handleSuspendUser(); }}
            disabled={isLoading}
            title={t('admin.suspendUser')}
          >
            {actionLoading === 'suspend' ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
          </button>
          <button
            className="touch-btn rounded-xl text-surface-400 hover:text-emerald-500 hover:bg-emerald-50 transition-all"
            onClick={(e) => { e.stopPropagation(); handleUnsuspendUser(); }}
            disabled={isLoading}
            title={t('admin.unsuspendUser')}
          >
            {actionLoading === 'unsuspend' ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
          </button>
          <button
            className={`touch-btn rounded-xl transition-all ${expanded ? 'text-primary-600 bg-primary-50' : 'text-surface-400 hover:text-surface-600 hover:bg-surface-100'}`}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            <Eye size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-surface-100 bg-surface-50/50 p-4 sm:p-6 space-y-4 animate-slide-down">
          <h4 className="text-sm font-semibold text-surface-700">{t('admin.reportDetails', { count: reports.length })}</h4>
          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report._id} className="bg-white rounded-xl p-4 border border-surface-200 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <span className="badge-danger text-[11px] capitalize">{report.reason}</span>
                    <span className="text-xs text-surface-400 ml-2">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    className="btn-ghost text-xs text-emerald-600 hover:bg-emerald-50"
                    onClick={() => handleDismiss(report._id)}
                    disabled={isLoading}
                  >
                    {actionLoading === 'dismiss' ? (
                      <Loader2 size={12} className="animate-spin mr-1" />
                    ) : (
                      <CheckCircle size={14} className="mr-1" />
                    )}
                    {t('admin.dismiss')}
                  </button>
                </div>
                {report.description && (
                  <p className="text-xs text-surface-500 mt-2">{report.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardStats({ stats }) {
  const { t } = useTranslation();
  const cards = [
    { label: t('admin.totalUsers'), value: stats.totalUsers, icon: Users, color: 'text-primary-600', bg: 'bg-primary-50' },
    { label: t('admin.activePosts'), value: stats.totalPosts, icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: t('admin.pendingReports'), value: stats.pendingReports, icon: Flag, color: 'text-red-600', bg: 'bg-red-50' },
    { label: t('admin.suspended'), value: stats.suspendedUsers, icon: UserX, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="card p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-surface-900">{value}</p>
              <p className="text-xs text-surface-500 mt-0.5">{label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminModerationTable() {
  const { t } = useTranslation();
  const [reportedPosts, setReportedPosts] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [reportsRes, statsRes] = await Promise.all([
        adminAPI.getReportedPosts(),
        adminAPI.getDashboardStats(),
      ]);
      setReportedPosts(reportsRes.data.reportedPosts);
      setStats(statsRes.data.stats);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load moderation data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-12 text-center space-y-4">
        <AlertTriangle size={40} className="mx-auto text-red-400" />
        <p className="text-red-600 font-medium">{error}</p>
        <button className="btn-soft" onClick={fetchData}>
          <RefreshCw size={16} className="mr-2" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-sm">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-surface-900">{t('admin.dashboard')}</h1>
            <p className="text-sm text-surface-500">{t('admin.subtitle')}</p>
          </div>
        </div>
        <button className="btn-ghost" onClick={fetchData}>
          <RefreshCw size={16} className="mr-1.5" /> {t('admin.refresh')}
        </button>
      </div>

      {stats && <DashboardStats stats={stats} />}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-surface-900">
              {t('admin.reportedContent')}
              {reportedPosts.length > 0 && (
                <span className="text-surface-400 font-normal text-sm ml-2">({reportedPosts.length})</span>
              )}
            </h2>
            <p className="text-sm text-surface-500 mt-0.5">{t('admin.reportedHint')}</p>
          </div>
        </div>

        {reportedPosts.length === 0 ? (
          <div className="card p-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
              <CheckCircle size={28} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-surface-500 font-medium">{t('admin.allClear')}</p>
              <p className="text-sm text-surface-400 mt-1">{t('admin.allClearHint')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {reportedPosts.map((group) => (
              <ReportRow key={group._id} reportGroup={group} onAction={fetchData} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
