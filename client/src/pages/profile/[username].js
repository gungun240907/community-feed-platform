import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { Loader2, Calendar, Users, UserPlus, UserMinus, Inbox, RefreshCw, Edit3, MapPin, Link as LinkIcon, Sparkles, Award, ArrowUp, ArrowDown, Gift, Shield, CheckCircle, XCircle, X, Send, AlertTriangle, FileText, History, LogOut } from 'lucide-react';
import { userAPI, reputationAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/I18nContext';
import PostCard from '../../components/PostCard';
import ProfileBadge from '../../components/ProfileBadge';

const repReasonLabels = {
  post_answer: 'Posted an answer', accepted_answer: 'Answer accepted',
  answer_5_upvotes: 'Answer reached 5 upvotes', question_10_upvotes: 'Question reached 10 upvotes',
  profile_completed: 'Profile completed', downvote_received: 'Downvote received',
  answer_deleted: 'Answer deleted', admin_removed: 'Content removed by admin',
  transfer_sent: 'Reputation transferred out', transfer_received: 'Reputation transferred in',
};

export default function ProfilePage() {
  const router = useRouter();
  const { username } = router.query;
  const { user: currentUser, logout } = useAuth();
  const { t } = useTranslation();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const sentinelRef = useRef(null);
  const [activeTab, setActiveTab] = useState('posts');
  const [repLogs, setRepLogs] = useState([]);
  const [repLoading, setRepLoading] = useState(false);
  const [repPage, setRepPage] = useState(1);
  const [repHasMore, setRepHasMore] = useState(false);
  const [privileges, setPrivileges] = useState(null);
  const [privilegesLoading, setPrivilegesLoading] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [transfersPage, setTransfersPage] = useState(1);
  const [transfersHasMore, setTransfersHasMore] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ receiverUsername: '', amount: '', reason: '' });
  const [transferError, setTransferError] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferInfo, setTransferInfo] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isOwnProfile = currentUser && profile && currentUser._id === profile._id;

  useEffect(() => {
    if (!username) return;
    setIsLoading(true);
    setError('');

    userAPI
      .getProfile(username)
      .then((res) => {
        setProfile(res.data.profile);
        setIsFollowing(res.data.profile.isFollowing);
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'User not found');
      })
      .finally(() => setIsLoading(false));
  }, [username]);

  useEffect(() => {
    if (!profile || !isOwnProfile) return;
    setPrivilegesLoading(true);
    reputationAPI.getPrivileges(profile._id)
      .then((res) => setPrivileges(res.data))
      .catch(() => {})
      .finally(() => setPrivilegesLoading(false));
  }, [profile, isOwnProfile]);

  useEffect(() => {
    if (!profile || activeTab !== 'reputation' || !isOwnProfile) return;
    setRepLoading(true);
    reputationAPI.getHistory(profile._id, 1)
      .then((res) => { setRepLogs(res.data.logs); setRepPage(1); setRepHasMore(res.data.pagination.hasMore); })
      .catch(() => {})
      .finally(() => setRepLoading(false));
  }, [profile, activeTab, isOwnProfile]);

  useEffect(() => {
    if (!profile || activeTab !== 'transfers' || !isOwnProfile) return;
    setTransfersLoading(true);
    reputationAPI.getTransfers(profile._id, 1)
      .then((res) => { setTransfers(res.data.transfers); setTransfersPage(1); setTransfersHasMore(res.data.pagination.hasMore); })
      .catch(() => {})
      .finally(() => setTransfersLoading(false));
  }, [profile, activeTab, isOwnProfile]);

  const fetchPosts = useCallback(async (pageNum = 1) => {
    if (!username) return;
    try {
      if (pageNum === 1) setPostsLoading(true);
      const res = await userAPI.getUserPosts(username, pageNum, 10);
      setPosts((prev) => (pageNum === 1 ? res.data.posts : [...prev, ...res.data.posts]));
      setHasMore(res.data.pagination.hasMore);
      setPage(pageNum);
      setPostsError('');
    } catch (err) {
      setPostsError(err.response?.data?.error || 'Failed to load posts');
    } finally {
      setPostsLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchPosts(1);
  }, [fetchPosts]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !postsLoading) {
          fetchPosts(page + 1);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, postsLoading, page, fetchPosts]);

  const handleDelete = useCallback((postId) => {
    setPosts((prev) => prev.filter((p) => p._id !== postId));
  }, []);

  const handleUpdate = useCallback((postId, updates) => {
    setPosts((prev) =>
      prev.map((p) => (p._id === postId ? { ...p, ...updates } : p))
    );
  }, []);

  const handleFollow = async () => {
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await userAPI.unfollow(username);
        setIsFollowing(false);
        setProfile((prev) => ({
          ...prev,
          followersCount: Math.max(0, prev.followersCount - 1),
        }));
      } else {
        await userAPI.follow(username);
        setIsFollowing(true);
        setProfile((prev) => ({
          ...prev,
          followersCount: prev.followersCount + 1,
        }));
      }
    } catch (err) {
      console.error('Follow action failed:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  const loadMoreRep = async () => {
    if (!repHasMore || repLoading) return;
    const next = repPage + 1;
    setRepLoading(true);
    try {
      const res = await reputationAPI.getHistory(profile._id, next);
      setRepLogs((prev) => [...prev, ...res.data.logs]);
      setRepPage(next);
      setRepHasMore(res.data.pagination.hasMore);
    } catch {}
    setRepLoading(false);
  };

  const loadMoreTransfers = async () => {
    if (!transfersHasMore || transfersLoading) return;
    const next = transfersPage + 1;
    setTransfersLoading(true);
    try {
      const res = await reputationAPI.getTransfers(profile._id, next);
      setTransfers((prev) => [...prev, ...res.data.transfers]);
      setTransfersPage(next);
      setTransfersHasMore(res.data.pagination.hasMore);
    } catch {}
    setTransfersLoading(false);
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setTransferError('');
    setTransferSubmitting(true);
    try {
      const res = await reputationAPI.transfer(transferForm);
      setTransferInfo(res.data.message);
      setTransferForm({ receiverUsername: '', amount: '', reason: '' });
      setProfile((prev) => ({ ...prev, reputation: (prev.reputation || 0) - parseInt(transferForm.amount) }));
      setTimeout(() => { setShowTransferModal(false); setTransferInfo(null); }, 2000);
    } catch (err) {
      setTransferError(err.response?.data?.error || 'Transfer failed');
    } finally {
      setTransferSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="card p-16 text-center space-y-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto">
          <Users size={28} className="text-surface-400" />
        </div>
        <p className="text-surface-500 font-medium">{error || 'User not found'}</p>
        <a href="/" className="btn-ghost mt-2">Go Home</a>
      </div>
    );
  }

  const tabs = [
    { key: 'posts', label: t('profile.posts'), count: posts.length },
    ...(isOwnProfile ? [
      { key: 'reputation', label: t('profile.reputationTab') },
      { key: 'transfers', label: t('profile.transfersTab') },
      { key: 'privileges', label: t('profile.privilegesTab') },
    ] : []),
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-accent-600 p-1">
        <div className="rounded-[calc(1rem-4px)] bg-white p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-3xl sm:text-4xl font-bold flex-shrink-0 shadow-lg shadow-primary-500/20">
              {profile.avatar ? (
                <img src={profile.avatar} alt="" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                (profile.displayName || profile.username)[0].toUpperCase()
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 flex items-center gap-2 flex-wrap">
                    {profile.displayName || profile.username}
                    <ProfileBadge badge={profile.badge} size="md" />
                    {profile.featuredProfile && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-[10px] font-bold shadow-sm">
                        <Sparkles size={10} /> {t('profile.featured')}
                      </span>
                    )}
                  </h1>
                  <p className="text-sm text-surface-500 mt-0.5">@{profile.username}</p>
                </div>
                {isOwnProfile ? (
                  <a href="/edit-profile" className="btn-ghost text-sm flex-shrink-0">
                    <Edit3 size={16} className="mr-1.5" /> {t('profile.edit')}
                  </a>
                ) : currentUser && (
                  <button
                    className={`text-sm flex-shrink-0 ${
                      isFollowing ? 'btn-secondary' : 'btn-primary shadow-lg shadow-primary-500/20'
                    }`}
                    onClick={handleFollow}
                    disabled={followLoading}
                  >
                    {followLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : isFollowing ? (
                      <>
                        <UserMinus size={16} className="mr-1.5" /> {t('profile.followingBtn')}
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} className="mr-1.5" /> {t('profile.follow')}
                      </>
                    )}
                  </button>
                )}
              </div>

              {profile.bio && (
                <p className="text-sm text-surface-600 mt-3 leading-relaxed">{profile.bio}</p>
              )}

              <div className="flex items-center gap-4 sm:gap-6 mt-4 text-sm text-surface-500 flex-wrap">
                <a
                  href={`/users/${profile.username}/followers`}
                  className="flex items-center gap-1.5 hover:text-primary-600 transition-colors"
                >
                  <Users size={15} className="text-primary-500" />
                  <strong className="text-surface-700">{profile.followersCount || 0}</strong> {t('profile.followers')}
                </a>
                <a
                  href={`/users/${profile.username}/following`}
                  className="flex items-center gap-1.5 hover:text-primary-600 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-surface-300" />
                  <strong className="text-surface-700">{profile.followingCount || 0}</strong> {t('profile.following')}
                </a>
                <span className="flex items-center gap-1.5">
                  <Award size={15} className="text-amber-500" />
                  <strong className="text-surface-700">{profile.reputation || 0}</strong> {t('profile.reputation')}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={15} className="text-surface-400" />
                  {t('profile.joined', { date: new Date(profile.createdAt).toLocaleDateString() })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isOwnProfile && (
        <div className="flex gap-3 flex-wrap">
          <a href="/sessions" className="btn-ghost text-sm gap-2">
            <Shield size={16} /> {t('nav.sessions', 'Sessions')}
          </a>
          <a href="/login-history" className="btn-ghost text-sm gap-2">
            <History size={16} /> {t('nav.loginHistory', 'Login History')}
          </a>
          <button onClick={() => setShowLogoutConfirm(true)} className="btn-ghost text-sm gap-2 text-red-500 hover:text-red-600 hover:bg-red-50">
            <LogOut size={16} /> Logout
          </button>
        </div>
      )}

      <div className="flex gap-1 bg-surface-100 rounded-xl p-1 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.key === 'posts' ? <FileText size={15} /> : tab.key === 'reputation' ? <Award size={15} /> : tab.key === 'transfers' ? <Gift size={15} /> : <Shield size={15} />}
            {tab.label}
            {tab.count !== undefined && <span className="text-xs text-surface-400 ml-1">({tab.count})</span>}
          </button>
        ))}
      </div>

      {activeTab === 'posts' && (
        <div className="space-y-4">
          {postsLoading && posts.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="skeleton-avatar" />
                    <div className="space-y-2">
                      <div className="skeleton h-4 w-24" />
                      <div className="skeleton h-3 w-16" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="skeleton h-4 w-full" />
                    <div className="skeleton h-4 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : postsError ? (
            <div className="card p-12 text-center space-y-3">
              <RefreshCw size={32} className="mx-auto text-red-400" />
              <p className="text-red-600 font-medium">{postsError}</p>
              <button className="btn-soft mt-2" onClick={() => fetchPosts(1)}>
                {t('common.retry')}
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className="card p-16 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto">
                <Inbox size={28} className="text-surface-400" />
              </div>
              {isOwnProfile ? (
                <>
                  <p className="text-surface-500 font-medium">{t('profile.noPosts')}</p>
                  <p className="text-sm text-surface-400">{t('profile.noPostsOwn')}</p>
                </>
              ) : (
                <>
                  <p className="text-surface-500 font-medium">{t('profile.noPosts')}</p>
                  <p className="text-sm text-surface-400">{t('profile.noPostsOther')}</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post, index) => (
                <div key={post._id} ref={index === posts.length - 1 ? sentinelRef : null}>
                  <PostCard post={post} onUpdate={handleUpdate} onDelete={handleDelete} />
                </div>
              ))}
            </div>
          )}

          {postsLoading && posts.length > 0 && (
            <div className="flex justify-center py-6">
              <div className="flex items-center gap-2 text-surface-400">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">{t('common.loading')}</span>
              </div>
            </div>
          )}

          {!hasMore && posts.length > 0 && (
            <p className="text-center text-sm text-surface-400 py-6">{t('profile.end')}</p>
          )}
        </div>
      )}

      {activeTab === 'reputation' && (
        <div className="card p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-surface-900">{t('profile.reputationActivity')}</h2>
            {repLoading && <Loader2 size={16} className="animate-spin text-surface-400" />}
          </div>
          {repLogs.length === 0 && !repLoading ? (
            <div className="py-12 text-center space-y-3">
              <Award size={32} className="mx-auto text-surface-300" />
<p className="text-surface-500 font-medium">{t('profile.reputationEmpty')}</p>
               <p className="text-sm text-surface-400">{t('profile.reputationEmptyHint')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {repLogs.map((log) => (
                <div key={log._id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-surface-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${log.amount > 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      {log.amount > 0 ? <ArrowUp size={15} className="text-emerald-500" /> : <ArrowDown size={15} className="text-red-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-900 truncate">{repReasonLabels[log.reason] || log.reason}</p>
                      <p className="text-xs text-surface-400">{new Date(log.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ml-3 ${log.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {log.amount > 0 ? '+' : ''}{log.amount}
                  </span>
                </div>
              ))}
              {repHasMore && (
                <button className="btn-ghost text-sm w-full mt-2" onClick={loadMoreRep} disabled={repLoading}>
                  {repLoading ? t('common.loading') : t('common.loadMore')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'transfers' && (
        <div className="space-y-4">
          {isOwnProfile && (
            <button className="btn-primary text-sm w-full" onClick={async () => {
              try {
                const res = await reputationAPI.checkCanTransfer();
                if (!res.data.canTransfer) {
                  alert(`You need more than ${res.data.requiredReputation} reputation points to transfer. You currently have ${res.data.reputation}.`);
                  return;
                }
                setTransferInfo(null);
                setTransferError('');
                setTransferForm({ receiverUsername: '', amount: '', reason: '' });
                setShowTransferModal(true);
              } catch { alert('Failed to check transfer eligibility'); }
            }}>
              <Send size={16} className="mr-1.5" /> {t('profile.transfer.button')}
            </button>
          )}
          <div className="card p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold text-surface-900">{t('profile.transfer.history')}</h2>
            {transfers.length === 0 && !transfersLoading ? (
              <div className="py-12 text-center space-y-3">
                <Gift size={32} className="mx-auto text-surface-300" />
                <p className="text-surface-500 font-medium">{t('profile.transfer.empty')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transfers.map((transferItem) => {
                  const isSender = currentUser && transferItem.sender?._id === currentUser._id;
                  return (
                    <div key={transferItem._id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-surface-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isSender ? 'bg-red-50' : 'bg-emerald-50'}`}>
                          {isSender ? <ArrowUp size={15} className="text-red-500" /> : <ArrowDown size={15} className="text-emerald-500" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-surface-900 truncate">
                            {isSender ? t('profile.transfer.to', { username: transferItem.receiver?.username || 'unknown' }) : t('profile.transfer.from', { username: transferItem.sender?.username || 'unknown' })}
                          </p>
                          <p className="text-xs text-surface-400 truncate">{transferItem.reason}</p>
                          <p className="text-xs text-surface-400">{new Date(transferItem.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold flex-shrink-0 ml-3 ${isSender ? 'text-red-600' : 'text-emerald-600'}`}>
                        {isSender ? '-' : '+'}{transferItem.amount}
                      </span>
                    </div>
                  );
                })}
                {transfersHasMore && (
                  <button className="btn-ghost text-sm w-full mt-2" onClick={loadMoreTransfers} disabled={transfersLoading}>
                    {transfersLoading ? t('common.loading') : t('common.loadMore')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'privileges' && (
        <div className="card p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-surface-900">{t('profile.privileges.title')}</h2>
          {privilegesLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-surface-400" /></div>
          ) : privileges ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <Award size={18} className="text-amber-500" />
                <span className="text-sm text-amber-800 font-medium">{t('profile.privileges.points', { points: privileges.reputation })}</span>
              </div>
              {[
                { label: t('profile.privileges.comment'), required: 50, unlocked: privileges.privileges.commentWithoutRestriction },
                { label: t('profile.privileges.edit'), required: 100, unlocked: privileges.privileges.editCommunityPosts },
                { label: t('profile.privileges.vote'), required: 250, unlocked: privileges.privileges.voteToClose },
                { label: t('profile.privileges.report'), required: 500, unlocked: privileges.privileges.reportContent },
              ].map(({ label, required, unlocked }) => (
                <div key={label} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${unlocked ? 'bg-emerald-50 border-emerald-200' : 'bg-surface-50 border-surface-200'}`}>
                  <div className="flex items-center gap-3">
                    {unlocked ? <CheckCircle size={18} className="text-emerald-500" /> : <XCircle size={18} className="text-surface-300" />}
                    <div>
                      <p className={`text-sm font-medium ${unlocked ? 'text-emerald-800' : 'text-surface-500'}`}>{label}</p>
                      <p className="text-xs text-surface-400">{unlocked ? t('profile.privileges.unlocked') : t('profile.privileges.required', { points: required })}</p>
                    </div>
                  </div>
                  {unlocked && <span className="badge-success text-[11px]">{t('profile.privileges.active')}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-surface-400 text-center py-8">Unable to load privileges</p>
          )}
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
             onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-scale-in"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-surface-900">{t('nav.logout')}</h3>
                <p className="text-sm text-surface-500">{t('nav.logoutConfirm') || 'Are you sure you want to logout?'}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowLogoutConfirm(false)}>{t('common.cancel') || 'Cancel'}</button>
              <button className="btn-danger" onClick={() => { logout(); setShowLogoutConfirm(false); }}>
                <LogOut size={16} className="mr-1.5" /> {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg text-surface-900 flex items-center gap-2">
                <Send size={18} className="text-primary-500" /> {t('profile.transfer.title')}
              </h3>
              <button className="touch-btn rounded-xl text-surface-400 hover:text-surface-600 hover:bg-surface-100" onClick={() => { setShowTransferModal(false); setTransferInfo(null); }}>
                <X size={18} />
              </button>
            </div>

            {transferInfo && (
              <div className="bg-emerald-50 text-emerald-700 text-sm p-3.5 rounded-xl border border-emerald-200 flex items-start gap-2 animate-slide-down">
                <CheckCircle size={16} className="mt-0.5 flex-shrink-0" /><span>{transferInfo}</span>
              </div>
            )}

            {transferError && (
              <div className="bg-red-50 text-red-600 text-sm p-3.5 rounded-xl border border-red-200 flex items-start gap-2 animate-slide-down">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /><span>{transferError}</span>
              </div>
            )}

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('profile.transfer.receiver')}</label>
                <input type="text" className="input-field" value={transferForm.receiverUsername}
                  onChange={(e) => setTransferForm({ ...transferForm, receiverUsername: e.target.value })}
                  placeholder="@username" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('profile.transfer.amount')}</label>
                <input type="number" className="input-field" value={transferForm.amount}
                  onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                  placeholder="1-50" min="1" max="50" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('profile.transfer.reason')}</label>
                <textarea className="input-field text-sm min-h-[60px]" value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  placeholder={t('profile.transfer.reasonHint')} maxLength={200} required />
                <p className="text-xs text-surface-400 mt-1 text-right">{transferForm.reason.length}/200</p>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={transferSubmitting || !transferForm.receiverUsername || !transferForm.amount || !transferForm.reason}>
                {transferSubmitting ? <><Loader2 size={16} className="animate-spin mr-1.5" /> {t('profile.transfer.transferring')}</> : <><Send size={16} className="mr-1.5" /> {t('profile.transfer.submit')}</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
