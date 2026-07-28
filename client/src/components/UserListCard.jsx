import React, { useState } from 'react';
import { Loader2, UserPlus, UserMinus } from 'lucide-react';
import { userAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';

export default function UserListCard({ profileUser }) {
  const { user: currentUser } = useAuth();
  const [isFollowing, setIsFollowing] = useState(profileUser.isFollowing || false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(profileUser.followersCount || 0);
  const { t } = useTranslation();

  const isOwn = currentUser && profileUser._id === currentUser._id;

  const handleFollowToggle = async () => {
    if (!currentUser || isOwn) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await userAPI.unfollow(profileUser.username);
        setIsFollowing(false);
        setFollowerCount((c) => Math.max(0, c - 1));
      } else {
        await userAPI.follow(profileUser.username);
        setIsFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    } catch (err) {
      console.error('Follow toggle failed:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50 transition-colors">
      <a
        href={`/profile/${profileUser.username}`}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
          {profileUser.avatar ? (
            <img src={profileUser.avatar} alt="" className="w-full h-full object-cover rounded-full" />
          ) : (
            (profileUser.displayName || profileUser.username || '?')[0].toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-surface-900 truncate">
            {profileUser.displayName || profileUser.username}
          </p>
          <p className="text-xs text-surface-400 truncate">
            @{profileUser.username}
            {followerCount > 0 && (
              <span className="ml-2">{followerCount} follower{followerCount !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
      </a>

      {currentUser && !isOwn && (
        <button
          className={`text-xs flex-shrink-0 ${
            isFollowing ? 'btn-secondary' : 'btn-primary'
          }`}
          onClick={handleFollowToggle}
          disabled={followLoading}
        >
          {followLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : isFollowing ? (
            <>
              <UserMinus size={14} className="mr-1" /> {t('profile.followingBtn')}
            </>
          ) : (
            <>
              <UserPlus size={14} className="mr-1" /> {t('profile.follow')}
            </>
          )}
        </button>
      )}
    </div>
  );
}