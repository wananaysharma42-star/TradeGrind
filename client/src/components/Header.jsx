import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Bell, Settings, Search, Sparkles, User, ArrowRight } from 'lucide-react';
import { toggleNotificationDrawer } from '../store/slices/notificationSlice.js';
import { setSearchQuery } from '../store/slices/marketSlice.js';

export default function Header({ activeTab, setActiveTab, onExecuteCommand }) {
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const simTime = useSelector(state => state.market.simTime);
  const unreadCount = useSelector(state => state.notification.unreadCount);
  const [commandInput, setCommandInput] = useState('');

  const isCompany = user?.role === 'COMPANY';

  const pillTabs = isCompany ? [
    { id: 'company-overview', label: 'Company Overview' },
    { id: 'company-holders', label: 'Holders Breakdown' },
    { id: 'company-simulate', label: 'What-If Engine' },
  ] : [
    { id: 'market', label: 'Market' },
    { id: 'portfolio', label: 'Wallet & Portfolio' },
    { id: 'targets', label: 'Targets' },
    { id: 'watchlist', label: 'Watchlist' }
  ];

  const handleCommandSubmit = (e) => {
    e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd) return;

    const lower = cmd.toLowerCase();
    if (lower.startsWith('buy ') || lower.startsWith('sell ')) {
      const parts = cmd.split(/\s+/);
      const action = parts[0].toUpperCase();
      const symbol = parts[1]?.toUpperCase();
      const qty = parseInt(parts[2], 10) || 1;
      if (symbol && onExecuteCommand) {
        onExecuteCommand({ action, symbol, quantity: qty });
        setCommandInput('');
        return;
      }
    } else if (lower.startsWith('go ')) {
      const target = lower.replace('go ', '').trim();
      if (target.includes('port') || target.includes('wall')) setActiveTab('portfolio');
      else if (target.includes('mark') || target.includes('dash')) setActiveTab('market');
      else if (target.includes('watch')) setActiveTab('watchlist');
      else if (target.includes('targ') || target.includes('alert')) setActiveTab('targets');
      else if (target.includes('sim')) setActiveTab('company-simulate');
      setCommandInput('');
      return;
    }

    dispatch(setSearchQuery(cmd));
  };

  return (
    <header className="mb-6 space-y-4 text-text">
      {/* Top Bar Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Page Greeting with name in gold #F5B93B */}
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-text tracking-tight">
            Welcome, <span className="text-accent font-bold">{user?.username || 'Trader'}</span>
          </h1>
          <p className="text-sm text-text-muted mt-1 flex items-center space-x-2">
            <span>{isCompany ? 'Corporate Stock Command' : 'Simulated Trading Floor'}</span>
            <span className="text-border">•</span>
            <span className="text-accent font-medium bg-accent/15 px-2 py-0.5 rounded-full text-xs border border-accent/25">
              {simTime?.formatted || 'Day 1 • 09:15 AM'}
            </span>
          </p>
        </div>

        {/* Right Header Icons & Avatar */}
        <div className="flex items-center space-x-3 self-end md:self-auto">
          {/* Notifications Button */}
          <button
            onClick={() => dispatch(toggleNotificationDrawer())}
            className="relative w-11 h-11 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted hover:text-text hover:border-accent/40 transition-colors shadow-glass"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-loss text-white font-bold text-[11px] rounded-full flex items-center justify-center animate-pulse shadow-sm">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={() => alert(`Active Role: ${user?.role}\nSimulation Clock: ${simTime?.formatted}\nEngine: Pure JavaScript GBM (dt = 1/98280)`)}
            className="w-11 h-11 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted hover:text-text hover:border-accent/40 transition-colors shadow-glass"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* User Profile Block */}
          <div className="glass-panel px-3.5 py-1.5 flex items-center space-x-3 rounded-full border border-border bg-surface/70">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent-deep to-accent flex items-center justify-center font-bold text-xs text-[#0C0A07] uppercase shadow-glass-glow border border-accent/40">
              {user?.username ? user.username.slice(0, 2) : <User className="w-4 h-4" />}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-text leading-tight flex items-center space-x-1.5">
                <span>{user?.username || 'Trader'}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/30">
                  {user?.role}
                </span>
              </div>
              <div className="text-[11px] text-text-muted truncate max-w-[130px]">{user?.email || 'trader@tradegrind.in'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Under Greeting: Pill Tabs + Rounded Command/Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
        {/* Pill Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {pillTabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'glass-pill-active font-semibold shadow-glass-glow text-accent'
                    : 'glass-pill text-text-muted hover:text-text'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Command Search Bar */}
        <form onSubmit={handleCommandSubmit} className="relative flex-1 max-w-md">
          <input
            type="text"
            value={commandInput}
            onChange={(e) => {
              setCommandInput(e.target.value);
              dispatch(setSearchQuery(e.target.value));
            }}
            placeholder="Search stocks, commands (e.g. 'buy INFY 10', 'go portfolio')…"
            className="w-full glass-input pl-4 pr-11 py-2 text-xs text-text placeholder-text-muted/60 bg-surface border border-border"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-accent/15 hover:bg-accent/30 text-accent flex items-center justify-center transition-colors"
            title="Search or execute"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </header>
  );
}
