import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { X, CheckCheck, Bell, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { setNotificationDrawerOpen, markAllRead, markRead } from '../store/slices/notificationSlice.js';
import { api } from '../services/api.js';

export default function NotificationDrawer() {
  const dispatch = useDispatch();
  const isOpen = useSelector(state => state.notification.isOpen);
  const notifications = useSelector(state => state.notification.notifications);
  const unreadCount = useSelector(state => state.notification.unreadCount);

  if (!isOpen) return null;

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      dispatch(markAllRead());
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkSingle = async (id) => {
    try {
      await api.markNotificationRead(id);
      dispatch(markRead(id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm glass-panel h-full border-l border-white/10 p-6 flex flex-col justify-between shadow-2xl">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-mauve/20 border border-mauve/30 flex items-center justify-center text-mauve">
                <Bell className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-white">Notifications</h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-mauve/30 text-mauve font-semibold text-xs border border-mauve/40">
                  {unreadCount} new
                </span>
              )}
            </div>

            <button
              onClick={() => dispatch(setNotificationDrawerOpen(false))}
              className="p-1 rounded-full text-muted hover:text-white glass-panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mark All Read Button */}
          {notifications.length > 0 && unreadCount > 0 && (
            <div className="flex justify-end mb-3">
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-mauve hover:text-mauve-light flex items-center space-x-1 font-medium"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            </div>
          )}

          {/* List */}
          <div className="space-y-2.5 overflow-y-auto max-h-[calc(100vh-140px)] pr-1">
            {notifications.length === 0 ? (
              <div className="py-16 text-center text-muted text-xs">
                No notifications yet. Real-time order fills and target alerts will appear here.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id || n.id}
                  onClick={() => handleMarkSingle(n._id || n.id)}
                  className={`p-3.5 rounded-20 glass-tile border transition-all cursor-pointer ${
                    !n.read
                      ? 'border-mauve/40 bg-white/[0.06]'
                      : 'border-white/5 opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold text-white tracking-tight flex items-center space-x-1.5">
                      {n.type === 'TARGET_HIT' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-tradeGreen shrink-0" />
                      ) : n.type === 'ORDER_CANCELLED' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-tradeRed shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-mauve shrink-0" />
                      )}
                      <span>{n.title}</span>
                    </span>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-mauve shrink-0 mt-1"></span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-1 leading-snug">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
