import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { Loader2, Calendar, Users, UserPlus, UserMinus, Inbox, RefreshCw, MapPin, Link as LinkIcon } from 'lucide-react';
import { userAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import PostCard from '../../components/PostCard';

export default function ProfilePage() {
  const router = useRouter();
  const { username } = router.query;
  const { user: currentUser } = useAuth();
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

  const isOwnProfile = currentUser && currentUser._id === profile._id;

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
                  <h1 className="text-2xl sm:text-3xl font-bold text-surface-900">
                    {profile.displayName || profile.username}
                  </h1>
                  <p className="text-sm text-surface-500 mt-0.5">@{profile.username}</p>
                </div>
                {!isOwnProfile && currentUser && (
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
                        <UserMinus size={16} className="mr-1.5" /> Following
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} className="mr-1.5" /> Follow
                      </>
                    )}
                  </button>
                )}
              </div>

              {profile.bio && (
                <p className="text-sm text-surface-600 mt-3 leading-relaxed">{profile.bio}</p>
              )}

              <div className="flex items-center gap-4 sm:gap-6 mt-4 text-sm text-surface-500 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Users size={15} className="text-primary-500" />
                  <strong className="text-surface-700">{profile.followersCount || 0}</strong> followers
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-surface-300" />
                  <strong className="text-surface-700">{profile.followingCount || 0}</strong> following
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={15} className="text-surface-400" />
                  Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-surface-900">
            Posts
            {!postsLoading && posts.length > 0 && (
              <span className="text-surface-400 font-normal text-sm ml-2">({posts.length})</span>
            )}
          </h2>
          {posts.length > 0 && (
            <button className="btn-ghost text-sm" onClick={() => fetchPosts(1)}>
              <RefreshCw size={15} className="mr-1" /> Refresh
            </button>
          )}
        </div>

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
              Try Again
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="card p-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto">
              <Inbox size={28} className="text-surface-400" />
            </div>
            {isOwnProfile ? (
              <>
                <p className="text-surface-500 font-medium">No posts yet</p>
                <p className="text-sm text-surface-400">Share something from the feed to get started!</p>
              </>
            ) : (
              <>
                <p className="text-surface-500 font-medium">No posts yet</p>
                <p className="text-sm text-surface-400">This user hasn't posted anything yet.</p>
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
              <span className="text-sm">Loading more posts...</span>
            </div>
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <p className="text-center text-sm text-surface-400 py-6">
            You've reached the end
          </p>
        )}
      </div>
    </div>
  );
}
