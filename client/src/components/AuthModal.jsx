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
        ? { email: 'ceo@infy.sim', password: 'Password123' }
        : { email: 'trader@tradesim.in', password: 'Password123' };

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
      <div className="glass-panel w-full max-w-md p-6 sm:p-8 border border-white/15 shadow-2xl relative overflow-hidden">
        {/* Background glow arc */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-plumGlow/40 rounded-full blur-3xl pointer-events-none"></div>

        {/* Brand Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-mauve to-mauve-dark flex items-center justify-center shadow-glass-glow">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-white flex items-center">
              Trade<span className="text-mauve">Sim</span>
            </div>
            <div className="text-[10px] text-muted tracking-wider uppercase font-medium">
              Deterministic Simulation Platform
            </div>
          </div>
        </div>

        {/* Switcher: Login vs Register */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-full border border-white/10 mb-6">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(null); }}
            className={`py-2 rounded-full text-xs font-bold transition-all ${
              isLogin ? 'glass-pill-active text-white' : 'text-muted hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(null); }}
            className={`py-2 rounded-full text-xs font-bold transition-all ${
              !isLogin ? 'glass-pill-active text-white' : 'text-muted hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Registration Role Selector */}
        {!isLogin && (
          <div className="mb-5">
            <label className="block text-xs font-medium text-muted mb-2">Select Your Role</label>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setRole('CUSTOMER')}
                className={`p-3 rounded-20 border cursor-pointer transition-all ${
                  role === 'CUSTOMER'
                    ? 'border-mauve bg-mauve/15 text-white shadow-glass-glow'
                    : 'border-white/10 bg-white/[0.03] text-muted hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-bold text-xs text-white">
                  <User className="w-3.5 h-3.5 text-mauve" />
                  <span>Customer</span>
                </div>
                <p className="text-[10px] text-muted mt-1">Invest ₹10 Lakh virtual money, set targets & alerts</p>
              </div>

              <div
                onClick={() => setRole('COMPANY')}
                className={`p-3 rounded-20 border cursor-pointer transition-all ${
                  role === 'COMPANY'
                    ? 'border-mauve bg-mauve/15 text-white shadow-glass-glow'
                    : 'border-white/10 bg-white/[0.03] text-muted hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-bold text-xs text-white">
                  <Building2 className="w-3.5 h-3.5 text-mauve" />
                  <span>Company</span>
                </div>
                <p className="text-[10px] text-muted mt-1">Own simulated stock, holders analytics & What-If simulator</p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {!isLogin && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Username</label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. RahulV"
                  className="w-full glass-input pl-10 pr-4 py-2 text-white text-xs"
                  required
                />
                <User className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Email Address</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@tradesim.in"
                className="w-full glass-input pl-10 pr-4 py-2 text-white text-xs"
                required
              />
              <Mail className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full glass-input pl-10 pr-4 py-2 text-white text-xs"
                required
              />
              <Lock className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Company Registration Extra Fields */}
          {!isLogin && role === 'COMPANY' && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Stock Symbol</label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. NOVA"
                    className="w-full glass-input px-3 py-2 text-white text-xs uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Initial Price (₹)</label>
                  <input
                    type="number"
                    value={initialPrice}
                    onChange={(e) => setInitialPrice(e.target.value)}
                    placeholder="1000"
                    className="w-full glass-input px-3 py-2 text-white text-xs"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Company Legal Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Nova Innovations Ltd."
                  className="w-full glass-input px-3 py-2 text-white text-xs"
                  required
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-16 bg-tradeRed/15 text-tradeRed border border-tradeRed/30 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-full text-xs font-bold bg-gradient-to-r from-mauve-deep to-mauve text-[#0B0709] hover:opacity-90 transition-all shadow-glass-glow mt-2"
          >
            {isLoading ? 'Processing...' : isLogin ? 'Sign In to TradeSim' : 'Register Account'}
          </button>
        </form>

        {/* Quick Demo Login Helper */}
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="text-[11px] text-muted text-center font-medium mb-2.5">
            Instant Demo Profiles (One-Click)
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('CUSTOMER')}
              className="py-2 px-3 rounded-full glass-tile border border-white/10 text-xs text-white hover:border-mauve/40 flex items-center justify-center space-x-1.5 transition-all"
            >
              <User className="w-3.5 h-3.5 text-mauve" />
              <span>Demo Customer</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('COMPANY')}
              className="py-2 px-3 rounded-full glass-tile border border-white/10 text-xs text-white hover:border-mauve/40 flex items-center justify-center space-x-1.5 transition-all"
            >
              <Building2 className="w-3.5 h-3.5 text-mauve" />
              <span>Demo Company</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
