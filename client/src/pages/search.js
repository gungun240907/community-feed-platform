import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Search, Loader2, Users, FileText, Inbox, RefreshCw, Crown, Zap, Sparkles } from 'lucide-react';
import PostCard from '../components/PostCard';
import UserListCard from '../components/UserListCard';
import { searchAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';

function SearchSkeleton() {
  return (
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
        </div>
      ))}
    </div>
  );
}

const tierMeta = {
  basic: { labelKey: 'search.tier.basic', icon: Search, className: 'bg-surface-100 text-surface-500' },
  advanced: { labelKey: 'search.tier.advanced', icon: Zap, className: 'bg-primary-50 text-primary-600' },
  highest: { labelKey: 'search.tier.highest', icon: Crown, className: 'bg-yellow-50 text-yellow-600' },
};

export default function SearchPage() {
  const router = useRouter();
  const { q } = router.query;
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTier, setSearchTier] = useState('basic');
  const [filterType, setFilterType] = useState('all');
  const [filterHashtag, setFilterHashtag] = useState('');
  const { t } = useTranslation();

  const fetchResults = useCallback(async (query) => {
    if (!query || query.trim().length < 2) return;
    setIsLoading(true);
    setError('');
    try {
      const params = {};
      if (filterType !== 'all') params.postType = filterType;
      if (filterHashtag.trim()) params.hashtag = filterHashtag.trim().replace(/^#/, '');
      const res = await searchAPI.search(query, params);
      setUsers(res.data.users || []);
      setPosts(res.data.posts || []);
      if (res.data.searchTier) setSearchTier(res.data.searchTier);
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed');
    } finally {
      setIsLoading(false);
    }
  }, [filterType, filterHashtag]);

  useEffect(() => {
    if (q) fetchResults(q);
  }, [q, fetchResults]);

  const canUseFilters = user && (searchTier === 'advanced' || searchTier === 'highest');
  const POST_TYPE_FILTERS = ['all', 'post', 'question', 'answer', 'showcase', 'achievement', 'snippet'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-accent-600 p-1">
        <div className="rounded-[calc(1rem-4px)] bg-white p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-sm">
              <Search size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-surface-900">
                {q ? t('search.results', { query: q }) : t('common.search')}
              </h1>
              <p className="text-sm text-surface-500 mt-0.5">
                {isLoading ? t('common.loading') : t('search.found', { userCount: users.length, postCount: posts.length })}
              </p>
              {user && tierMeta[searchTier] && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium mt-1.5 ${tierMeta[searchTier].className}`}>
                  {React.createElement(tierMeta[searchTier].icon, { size: 12 })}
                  {t(tierMeta[searchTier].labelKey)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {canUseFilters && q && (
        <div className="card p-4 space-y-3 animate-slide-down">
          <div className="flex flex-wrap gap-1.5">
            {POST_TYPE_FILTERS.map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterType === type ? 'bg-primary-600 text-white shadow-sm' : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
                }`}
              >
                {type === 'all' ? t('search.filter.all') : t(`post.type.${type}`)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-xs">
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                type="text"
                value={filterHashtag}
                onChange={(e) => setFilterHashtag(e.target.value.replace(/\s+/g, '').replace(/^#/, ''))}
                onKeyDown={(e) => e.key === 'Enter' && q && fetchResults(q)}
                placeholder={t('search.filter.hashtagPlaceholder')}
                className="input-field text-sm pl-8"
              />
            </div>
            <button className="btn-soft text-sm" onClick={() => q && fetchResults(q)}>
              {t('common.apply')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="card p-12 text-center space-y-4">
          <RefreshCw size={32} className="mx-auto text-red-400" />
          <p className="text-red-600 font-medium">{error}</p>
          <button className="btn-soft" onClick={() => fetchResults(q)}>
            {t('common.retry')}
          </button>
        </div>
      )}

      {isLoading ? (
        <SearchSkeleton />
      ) : !q ? (
        <div className="card p-8 sm:p-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto">
            <Search size={28} className="text-surface-400" />
          </div>
          <p className="text-surface-500 font-medium">{t('search.prompt')}</p>
          <p className="text-sm text-surface-400">{t('search.promptHint')}</p>
        </div>
      ) : users.length === 0 && posts.length === 0 ? (
        <div className="card p-8 sm:p-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto">
            <Inbox size={28} className="text-surface-400" />
          </div>
          <p className="text-surface-500 font-medium">{t('search.noResults')}</p>
          <p className="text-sm text-surface-400">{t('search.noResultsHint')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {users.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 px-3 py-2">
                <Users size={16} className="text-primary-500" />
                <h2 className="font-semibold text-surface-900 text-sm">Users ({users.length})</h2>
              </div>
              <div className="divide-y divide-surface-100">
                {users.map((u) => (
                  <UserListCard key={u._id} profileUser={u} />
                ))}
              </div>
            </div>
          )}

          {posts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-primary-500" />
                <h2 className="font-semibold text-surface-900 text-sm">Posts ({posts.length})</h2>
              </div>
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard key={post._id} post={post} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}