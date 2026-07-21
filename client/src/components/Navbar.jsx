import React from 'react';
import { Code2, Home, Flame, LogIn, UserPlus, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-surface-200/80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <Code2 size={18} className="text-white" />
            </div>
            <span className="hidden sm:inline text-lg font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
              DevFeed
            </span>
          </a>

          <div className="flex items-center gap-1 sm:gap-2">
            <a href="/" className="btn-ghost text-sm">
              <Home size={18} className="sm:mr-1.5" />
              <span className="hidden sm:inline">Home</span>
            </a>
            <a href="/trending" className="btn-ghost text-sm">
              <Flame size={18} className="sm:mr-1.5" />
              <span className="hidden sm:inline">Trending</span>
            </a>

            {isAuthenticated ? (
              <>
                <NotificationBell />
                {user?.role === 'admin' && (
                  <a href="/admin" className="btn-ghost text-sm" title="Admin Dashboard">
                    <Shield size={18} />
                  </a>
                )}
                <div className="flex items-center gap-2 ml-2 pl-3 border-l border-surface-200">
                  <a
                    href={`/profile/${user.username}`}
                    className="flex items-center gap-2.5 btn-ghost text-sm"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      {(user.displayName || user.username)[0].toUpperCase()}
                    </div>
                    <span className="hidden sm:inline text-sm font-medium max-w-[100px] truncate text-surface-700">
                      {user.displayName || user.username}
                    </span>
                  </a>
                  <button
                    className="btn-ghost text-sm text-surface-400 hover:text-red-500 p-2"
                    onClick={logout}
                    title="Logout"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 ml-2 pl-3 border-l border-surface-200">
                <a href="/login" className="btn-ghost text-sm">
                  <LogIn size={18} className="sm:mr-1.5" />
                  <span className="hidden sm:inline">Sign in</span>
                </a>
                <a href="/register" className="btn-primary text-sm">
                  <UserPlus size={18} className="sm:mr-1.5" />
                  <span className="hidden sm:inline">Get Started</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
