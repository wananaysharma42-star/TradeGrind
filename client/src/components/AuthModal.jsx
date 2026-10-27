import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { User, Lock, Mail, Building2, TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api.js';
import { setCredentials } from '../store/slices/authSlice.js';
import { initSocket } from '../services/socket.js';

export default function AuthModal({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('CUSTOMER'); // 'CUSTOMER' | 'COMPANY'

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Company specific fields
  const [companyName, setCompanyName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [initialPrice, setInitialPrice] = useState(1000);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const res = await api.login({ email, password });
        dispatch(setCredentials(res));
        initSocket();
        onClose();
      } else {
        const payload = {
          email,
          username,
          password,
          role,
          ...(role === 'COMPANY' ? { companyName, symbol, initialPrice: Number(initialPrice) } : {})
        };
        const res = await api.register(payload);
        dispatch(setCredentials(res));
        initSocket();
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async (demoRole) => {
    setIsLoading(true);
    setError(null);
    try {
      const creds = demoRole === 'COMPANY'
        ? { email: 'ceo@infy.sim', password: 'Password123!' }
        : { email: 'trader@tradegrind.in', password: 'Password123!' };

      const res = await api.login(creds);
      dispatch(setCredentials(res));
      initSocket();
      onClose();
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="glass-panel w-full max-w-md p-6 sm:p-8 border border-border shadow-2xl relative overflow-hidden bg-raised text-text">
        {/* Background glow arc */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-accent-deep/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Brand Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-deep flex items-center justify-center shadow-glass-glow text-[#0C0A07]">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-text flex items-center">
              Trade<span className="text-accent">Grind</span>
            </div>
            <div className="text-[10px] text-text-muted tracking-wider uppercase font-medium">
              Deterministic Simulation Platform
            </div>
          </div>
        </div>

        {/* Switcher: Login vs Register */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-surface rounded-full border border-border mb-6">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(null); }}
            className={`py-2 rounded-full text-xs font-bold transition-all ${
              isLogin ? 'glass-pill-active text-accent' : 'text-text-muted hover:text-text'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(null); }}
            className={`py-2 rounded-full text-xs font-bold transition-all ${
              !isLogin ? 'glass-pill-active text-accent' : 'text-text-muted hover:text-text'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Registration Role Selector */}
        {!isLogin && (
          <div className="mb-5">
            <label className="block text-xs font-medium text-text-muted mb-2">Select Your Role</label>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setRole('CUSTOMER')}
                className={`p-3 rounded-20 border cursor-pointer transition-all ${
                  role === 'CUSTOMER'
                    ? 'border-accent bg-accent/15 text-text shadow-glass-glow'
                    : 'border-border bg-surface text-text-muted hover:text-text'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-bold text-xs text-text">
                  <User className="w-3.5 h-3.5 text-accent" />
                  <span>Customer</span>
                </div>
                <p className="text-[10px] text-text-muted mt-1">Invest ₹10 Lakh virtual money, set targets & alerts</p>
              </div>

              <div
                onClick={() => setRole('COMPANY')}
                className={`p-3 rounded-20 border cursor-pointer transition-all ${
                  role === 'COMPANY'
                    ? 'border-accent bg-accent/15 text-text shadow-glass-glow'
                    : 'border-border bg-surface text-text-muted hover:text-text'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-bold text-xs text-text">
                  <Building2 className="w-3.5 h-3.5 text-accent" />
                  <span>Company</span>
                </div>
                <p className="text-[10px] text-text-muted mt-1">Own simulated stock, holders analytics & What-If simulator</p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {!isLogin && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Username</label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. RahulV"
                  className="w-full glass-input pl-10 pr-4 py-2 text-text text-xs bg-surface border border-border"
                  required
                />
                <User className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Email Address</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@tradegrind.in"
                className="w-full glass-input pl-10 pr-4 py-2 text-text text-xs bg-surface border border-border"
                required
              />
              <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full glass-input pl-10 pr-4 py-2 text-text text-xs bg-surface border border-border"
                required
              />
              <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Company Registration Extra Fields */}
          {!isLogin && role === 'COMPANY' && (
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Stock Symbol</label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. NOVA"
                    className="w-full glass-input px-3 py-2 text-text text-xs uppercase bg-surface border border-border"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Initial Price (₹)</label>
                  <input
                    type="number"
                    value={initialPrice}
                    onChange={(e) => setInitialPrice(e.target.value)}
                    placeholder="1000"
                    className="w-full glass-input px-3 py-2 text-text text-xs bg-surface border border-border"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Company Legal Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Nova Innovations Ltd."
                  className="w-full glass-input px-3 py-2 text-text text-xs bg-surface border border-border"
                  required
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-16 bg-loss/15 text-loss border border-loss/30 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-full text-xs font-bold bg-accent text-[#0C0A07] hover:bg-accent/90 transition-all shadow-glass-glow mt-2 cursor-pointer"
          >
            {isLoading ? 'Processing...' : isLogin ? 'Sign In to TradeGrind' : 'Register Account'}
          </button>
        </form>

        {/* Quick Demo Login Helper */}
        <div className="mt-6 pt-4 border-t border-border">
          <div className="text-[11px] text-text-muted text-center font-medium mb-2.5">
            Instant Demo Profiles (One-Click)
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('CUSTOMER')}
              className="py-2 px-3 rounded-full glass-tile border border-border text-xs text-text hover:border-accent/40 flex items-center justify-center space-x-1.5 transition-all bg-surface/60"
            >
              <User className="w-3.5 h-3.5 text-accent" />
              <span>Demo Customer</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('COMPANY')}
              className="py-2 px-3 rounded-full glass-tile border border-border text-xs text-text hover:border-accent/40 flex items-center justify-center space-x-1.5 transition-all bg-surface/60"
            >
              <Building2 className="w-3.5 h-3.5 text-accent" />
              <span>Demo Company</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
