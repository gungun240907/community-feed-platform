import React, { useCallback, useMemo, useEffect } from 'react';
import { Loader2, RefreshCw, AlertCircle, Inbox, Flame } from 'lucide-react';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import { feedAPI } from '../utils/api';
import PostCard from './PostCard';
import CreatePost from './CreatePost';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';

function FeedSkeleton() {
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
          <div className="space-y-2">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedEmpty({ isPersonalized, hashtag }) {
  const { t } = useTranslation();
  return (
    <div className="card p-8 sm:p-16 text-center space-y-4 animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto">
        <Inbox size={28} className="text-surface-400" />
      </div>
      {hashtag ? (
        <>
          <p className="text-surface-500 font-medium">No posts with #{hashtag}</p>
          <p className="text-sm text-surface-400">Try a different hashtag or check back later.</p>
        </>
      ) : isPersonalized ? (
        <>
          <p className="text-surface-500 font-medium">Your feed is empty</p>
          <p className="text-sm text-surface-400">Follow some developers to see their posts here!</p>
        </>
      ) : (
        <>
          <p className="text-surface-500 font-medium">{t('profile.noPosts')}</p>
          <p className="text-sm text-surface-400">Be the first to share something!</p>
        </>
      )}
    </div>
  );
}

export default function FeedContainer({ type = 'personalized', hashtag = '', limit = 10 }) {
  const { isAuthenticated, feedVersion } = useAuth();
  const { t } = useTranslation();

  const fetchFn = useCallback(
    (page, lim, filter) => {
      if (type === 'trending') return feedAPI.getTrending(lim || 20);
      return feedAPI.getPersonalized(page, lim || limit, filter?.hashtag || hashtag);
    },
    [type, limit, hashtag]
  );

  const memoizedFilter = useMemo(() => ({ hashtag }), [hashtag]);

  const {
    data: posts,
    isLoading,
    error,
    hasMore,
    lastElementRef,
    refresh,
    appendPost,
    removePost,
    updatePost,
  } = useInfiniteScroll(fetchFn, {
    initialPage: 1,
    limit,
    filter: memoizedFilter,
  });

  const handleDelete = useCallback(
    (postId) => {
      removePost(postId);
    },
    [removePost]
  );

  const handleUpdate = useCallback(
    (postId, updates) => {
      updatePost(postId, updates);
    },
    [updatePost]
  );

  useEffect(() => {
    refresh();
  }, [feedVersion, refresh]);

  if (error && posts.length === 0) {
    return (
      <div className="card p-12 text-center space-y-4 animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
          <AlertCircle size={28} className="text-red-400" />
        </div>
        <div>
          <p className="text-red-600 font-medium">{t('common.error')}</p>
          <p className="text-sm text-surface-400 mt-1">{error}</p>
        </div>
        <button className="btn-soft" onClick={refresh}>
          <RefreshCw size={16} className="mr-2" /> {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAuthenticated && type === 'personalized' && !hashtag && (
        <CreatePost onPostCreated={appendPost} />
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {hashtag ? (
            <span className="badge-primary text-sm px-3 py-1">#{hashtag}</span>
          ) : (
            <>
              {type === 'trending' && <Flame size={20} className="text-accent-500" />}
              <h2 className="text-lg font-bold text-surface-900">
                {type === 'trending' ? t('nav.trending') : 'Your Feed'}
              </h2>
            </>
          )}
        </div>
        <button
          onClick={refresh}
          className="btn-ghost text-sm"
          aria-label="Refresh feed"
        >
          <RefreshCw size={16} className="mr-1.5" /> Refresh
        </button>
      </div>

      {isLoading && posts.length === 0 ? (
        <FeedSkeleton />
      ) : posts.length === 0 ? (
        <FeedEmpty isPersonalized={type === 'personalized'} hashtag={hashtag} />
      ) : (
        <div className="space-y-4">
          {posts.map((post, index) => (
            <div
              key={post._id}
              ref={index === posts.length - 1 ? lastElementRef : null}
            >
              <PostCard
                post={post}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}

      {isLoading && posts.length > 0 && (
        <div className="flex justify-center py-6">
          <div className="flex items-center gap-2 text-surface-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Loading more posts...</span>
          </div>
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <p className="text-center text-sm text-surface-400 py-6">
          You've reached the end — check back later for more!
        </p>
      )}
    </div>
  );
}
