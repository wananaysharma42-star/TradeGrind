import React, { useState } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Crosshair,
  TrendingUp,
  Bell,
  Users,
  FlaskConical,
  Settings,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { logout } from '../../store/slices/authSlice.js';
import { api } from '../../services/api.js';

export function Sidebar({ collapsed, setCollapsed, className = '' }) {
  const user = useSelector((state) => state.auth.user);
  const unreadCount = useSelector((state) => state.notification.unreadCount);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const isCompany = user?.role === 'COMPANY';

  // Role-based navigation items
  const navItems = isCompany
    ? [
        { id: 'dashboard', label: 'Dashboard', path: '/company', icon: <LayoutDashboard className="w-5 h-5" /> },
        { id: 'analytics', label: 'Analytics', path: '/company/analytics', icon: <TrendingUp className="w-5 h-5" /> },
        { id: 'customers', label: 'Customers', path: '/company/customers', icon: <Users className="w-5 h-5" /> },
        { id: 'testing', label: 'Testing', path: '/company/testing', icon: <FlaskConical className="w-5 h-5" /> },
        { id: 'alerts', label: 'Alerts', path: '/company/alerts', icon: <Bell className="w-5 h-5" />, badge: unreadCount > 0 ? unreadCount : null },
        { id: 'methodology', label: 'Methodology', path: '/company/methodology', icon: <HelpCircle className="w-5 h-5" /> }
      ]
    : [
        { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
        { id: 'portfolio', label: 'Portfolio', path: '/portfolio', icon: <Briefcase className="w-5 h-5" /> },
        { id: 'analysis', label: 'Analysis', path: '/analysis', icon: <Crosshair className="w-5 h-5" /> },
        { id: 'market', label: 'Market', path: '/market', icon: <TrendingUp className="w-5 h-5" /> },
        { id: 'alerts', label: 'Alerts', path: '/alerts', icon: <Bell className="w-5 h-5" />, badge: unreadCount > 0 ? unreadCount : null },
        { id: 'methodology', label: 'Methodology', path: '/methodology', icon: <HelpCircle className="w-5 h-5" /> }
      ];

  const handleLogout = async () => {
    try {
      await api.logout().catch(() => {});
    } finally {
      dispatch(logout());
      navigate('/login');
    }
  };

  return (
    <aside
      className={clsx(
        'relative flex flex-col justify-between h-screen border-r border-border bg-glass-surface backdrop-blur-glass transition-all duration-300 z-30',
        collapsed ? 'w-20' : 'w-64',
        className
      )}
    >
      {/* Top: Logo & Toggle */}
      <div>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div
            onClick={() => navigate('/')}
            className="flex items-center space-x-3 cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-accent-deep flex items-center justify-center shadow-glass-glow shrink-0">
              <span className="text-[#0C0A07] font-black text-lg">T</span>
            </div>
            {!collapsed && (
              <div>
                <span className="text-base font-bold text-text tracking-wider">Trade</span>
                <span className="text-base font-light text-accent">Grind</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-full bg-surface border border-border text-text-muted hover:text-text transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1.5 mt-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={clsx(
                  'w-full flex items-center space-x-3.5 px-3.5 py-3 rounded-20 text-sm font-medium transition-all duration-200 group relative',
                  isActive
                    ? 'bg-amber-pill text-accent border border-accent/35 shadow-glass-glow font-semibold'
                    : 'text-text-muted hover:text-text hover:bg-surface/60'
                )}
              >
                <span className={clsx(isActive ? 'text-accent' : 'text-text-muted group-hover:text-text')}>
                  {item.icon}
                </span>
                {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                {item.badge && (
                  <span
                    className={clsx(
                      'px-2 py-0.5 text-[10px] font-bold rounded-full bg-loss text-white shadow-sm',
                      collapsed && 'absolute top-2 right-2'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Pinned: Settings, Support, Logout */}
      <div className="p-3 border-t border-border space-y-1">
        <button
          onClick={() => navigate('/settings')}
          className="w-full flex items-center space-x-3.5 px-3.5 py-2.5 rounded-20 text-sm font-medium text-text-muted hover:text-text hover:bg-surface/60 transition-colors"
        >
          <Settings className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>
        <button
          onClick={() => navigate('/support')}
          className="w-full flex items-center space-x-3.5 px-3.5 py-2.5 rounded-20 text-sm font-medium text-text-muted hover:text-text hover:bg-surface/60 transition-colors"
        >
          <HelpCircle className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Support</span>}
        </button>
        {user && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3.5 px-3.5 py-2.5 rounded-20 text-sm font-medium text-loss/80 hover:text-loss hover:bg-loss/10 transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
