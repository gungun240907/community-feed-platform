import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, Heart, MessageCircle, UserPlus, AtSign } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

const typeConfig = {
  like: { icon: Heart, color: 'text-red-500', bg: 'bg-red-50', label: 'liked your post' },
  comment: { icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-50', label: 'commented on your post' },
  reply: { icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-50', label: 'replied to your comment' },
  follow: { icon: UserPlus, color: 'text-green-500', bg: 'bg-green-50', label: 'started following you' },
  mention: { icon: AtSign, color: 'text-purple-500', bg: 'bg-purple-50', label: 'mentioned you' },
};

export default function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isAuthenticated) return null;

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className={`relative p-2 rounded-xl transition-all duration-200 ${
          isOpen ? 'bg-primary-50 text-primary-600' : 'text-surface-400 hover:text-surface-600 hover:bg-surface-100'
        }`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-surface-200 z-50 max-h-[480px] flex flex-col animate-scale-in overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-100">
            <h3 className="font-semibold text-sm text-surface-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium transition-colors"
                onClick={markAllAsRead}
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
                  <Bell size={24} className="text-surface-400" />
                </div>
                <p className="text-sm text-surface-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const config = typeConfig[notification.type] || typeConfig.like;
                const Icon = config.icon;

                return (
                  <button
                    key={notification._id}
                    className={`w-full text-left px-5 py-3.5 flex items-start gap-3.5 transition-colors ${
                      !notification.isRead ? 'bg-primary-50/50' : 'hover:bg-surface-50'
                    }`}
                    onClick={() => markAsRead(notification._id)}
                  >
                    <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={17} className={config.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-800 leading-relaxed">
                        <span className="font-semibold">
                          {notification.sender?.displayName || notification.sender?.username}
                        </span>{' '}
                        {config.label}
                      </p>
                      <span className="text-xs text-surface-400 mt-0.5 block">{timeAgo(notification.createdAt)}</span>
                    </div>
                    {!notification.isRead && (
                      <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-2.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
