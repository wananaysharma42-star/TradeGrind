import React from 'react';
import {
  LayoutDashboard,
  LineChart,
  Briefcase,
  Target,
  Clock,
  Building2,
  Users,
  Cpu,
  Settings,
  HelpCircle,
  TrendingUp,
  LogOut
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice.js';
import { api } from '../services/api.js';

export default function Sidebar({ activeTab, setActiveTab }) {
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const isCompany = user?.role === 'COMPANY';

  const customerNavItems = [
    { id: 'market', label: 'Market', icon: LayoutDashboard },
    { id: 'portfolio', label: 'My Portfolio', icon: Briefcase },
    { id: 'watchlist', label: 'Watchlist', icon: LineChart },
    { id: 'targets', label: 'Targets & Alerts', icon: Target },
    { id: 'orders', label: 'Order History', icon: Clock },
  ];

  const companyNavItems = [
    { id: 'company-overview', label: 'My Stock', icon: Building2 },
    { id: 'company-holders', label: 'Shareholders', icon: Users },
    { id: 'company-simulate', label: 'What-If Engine', icon: Cpu },
  ];

  const navItems = isCompany ? companyNavItems : customerNavItems;

  return (
    <aside className="w-64 glass-panel m-4 flex flex-col justify-between p-5 border border-border shrink-0 hidden md:flex bg-glass-surface backdrop-blur-glass text-text">
      <div>
        {/* Brand Logo */}
        <div className="flex items-center space-x-3 px-2 py-3 mb-8 cursor-pointer" onClick={() => setActiveTab(isCompany ? 'company-overview' : 'market')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-deep flex items-center justify-center shadow-glass-glow text-[#0C0A07]">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-text flex items-center">
              Trade<span className="text-accent">Grind</span>
              <span className="w-1.5 h-1.5 rounded-full bg-accent ml-1 animate-pulse"></span>
            </div>
            <div className="text-[10px] text-text-muted tracking-wider uppercase font-medium">Real-Time Simulator</div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          <div className="text-[11px] font-semibold text-text-muted/70 uppercase tracking-wider px-3 mb-2">
            {isCompany ? 'Issuer Controls' : 'Trading Hub'}
          </div>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-20 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'glass-pill-active font-semibold shadow-glass-glow text-accent'
                    : 'text-text-muted hover:text-text hover:bg-surface/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-text-muted'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Pinned Bottom Controls */}
      <div className="pt-4 border-t border-border space-y-1.5">
        <button
          onClick={() => alert('TradeGrind uses 100% deterministic mathematical simulations powered by pure JavaScript Geometric Brownian Motion, with 1 tick = 1 simulated minute.')}
          className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-20 text-sm text-text-muted hover:text-text hover:bg-surface/60 transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-text-muted" />
          <span>Simulation Engine</span>
        </button>

        <button
          onClick={async () => {
            try {
              await api.logout().catch(() => {});
            } finally {
              dispatch(logout());
            }
          }}
          className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-20 text-sm text-loss hover:bg-loss/10 transition-colors"
        >
          <LogOut className="w-4 h-4 text-loss" />
          <span>Exit Session</span>
        </button>
      </div>
    </aside>
  );
}
