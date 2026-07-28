import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Loader2, Users, ArrowLeft, Inbox } from 'lucide-react';
import { userAPI } from '../../../utils/api';
import UserListCard from '../../../components/UserListCard';
import { useTranslation } from '../../../context/I18nContext';

export default function FollowingPage() {
  const router = useRouter();
  const { username } = router.query;
  const [following, setFollowing] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    if (!username) return;
    setIsLoading(true);
    setError('');
    userAPI
      .getFollowing(username)
      .then((res) => setFollowing(res.data.following || []))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load following'))
      .finally(() => setIsLoading(false));
  }, [username]);

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
          <h1 className="text-xl font-bold text-surface-900">Following</h1>
          <p className="text-sm text-surface-500">
            People @{username} follows
            {!isLoading && <span className="ml-1">({following.length})</span>}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="card p-12 text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <button className="btn-soft mt-4" onClick={() => router.back()}>{t('common.goBack')}</button>
        </div>
      ) : following.length === 0 ? (
        <div className="card p-8 sm:p-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto">
            <Users size={28} className="text-surface-400" />
          </div>
          <p className="text-surface-500 font-medium">Not following anyone yet</p>
          <p className="text-sm text-surface-400">
            When @{username} follows someone, they will appear here.
          </p>
        </div>
      ) : (
        <div className="card p-4 divide-y divide-surface-100">
          {following.map((f) => (
            <UserListCard key={f._id} profileUser={f} />
          ))}
        </div>
      )}
    </div>
  );
}