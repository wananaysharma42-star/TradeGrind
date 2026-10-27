import React, { useState, useRef, useEffect } from 'react';
import { Bell, Settings, Search, Check, Clock } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Avatar } from '../ui/StatTile.jsx';
import { markRead, markAllRead } from '../../store/slices/notificationSlice.js';
import { api } from '../../services/api.js';

export function Header({ title = null, subtitle = null, onOpenSettings = null }) {
  const user = useSelector((state) => state.auth.user);
  const { notifications, unreadCount } = useSelector((state) => state.notification);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [bellOpen, setBellOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setBellOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      dispatch(markAllRead());
    } catch (e) {
      console.warn('Failed to mark read', e);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      try {
        await api.markNotificationRead(notif._id);
        dispatch(markRead(notif._id));
      } catch (e) {
        // ignore
      }
    }
  };

  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 gap-4">
      {/* Welcome Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Welcome, <span className="text-mauve">{user?.name || 'Trader'}</span>
        </h1>
        <p className="text-xs text-muted mt-0.5">
          {subtitle || 'Real-time quantitative trading simulation & high-fidelity portfolio modeling'}
        </p>
      </div>

      {/* Right Controls: Bell with Unread Badge & Dropdown, Settings, Avatar */}
      <div className="flex items-center space-x-3 self-end md:self-auto">
        {/* Bell Button */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setBellOpen(!bellOpen)}
            className="relative p-2.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-muted hover:text-white transition-all shadow-inner-glow"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-trade-red text-white text-[10px] font-bold flex items-center justify-center animate-pulse shadow-sm">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {bellOpen && (
            <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-24 bg-dark-base/95 border border-white/10 backdrop-blur-glass shadow-glass z-50 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-semibold text-white">Notifications</h4>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-mauve/20 text-mauve px-2 py-0.5 rounded-full font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-mauve hover:text-mauve-light transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted">No notifications yet.</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n._id}
                      onClick={() => handleNotificationClick(n)}
                      className={clsx(
                        'p-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer',
                        !n.read && 'bg-mauve/[0.07]'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <h5 className="text-xs font-semibold text-white">{n.title}</h5>
                        {!n.read && <div className="w-2 h-2 rounded-full bg-mauve mt-1 shrink-0 ml-2" />}
                      </div>
                      <p className="text-[11px] text-muted mt-1 leading-relaxed">{n.message}</p>
                      <div className="flex items-center space-x-1 text-[10px] text-muted/70 mt-2">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Round Settings Button */}
        <button
          onClick={() => {
            if (onOpenSettings) onOpenSettings();
            else navigate('/settings');
          }}
          className="p-2.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-muted hover:text-white transition-all shadow-inner-glow"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* User Avatar + Name + Email */}
        {user ? (
          <div className="flex items-center space-x-3 pl-2 border-l border-white/[0.08]">
            <Avatar name={user.name || 'User'} size="md" />
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-white leading-tight">{user.name}</div>
              <div className="text-[10px] text-muted leading-tight truncate max-w-[120px]">{user.email}</div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 rounded-full text-xs font-semibold bg-mauve-gradient text-dark-base"
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
