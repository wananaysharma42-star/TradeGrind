import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { LogIn, ArrowRight, ShieldCheck, TrendingUp, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '../../services/api.js';
import { setCredentials } from '../../store/slices/authSlice.js';
import { GlassCard } from '../../components/ui/GlassCard.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await api.login({ email, password });
      dispatch(setCredentials({ user: data.user, token: data.token }));
      if (data.user.role === 'COMPANY') {
        navigate('/company');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-bg bg-amber-radial text-text">
      <GlassCard className="w-full max-w-md p-8" glow>
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-full bg-gradient-to-br from-accent to-accent-deep items-center justify-center shadow-glass-glow mb-3 text-[#0C0A07]">
            <span className="font-black text-2xl">T</span>
          </div>
          <h2 className="text-2xl font-bold text-text tracking-tight">Welcome Back</h2>
          <p className="text-xs text-text-muted mt-1">Sign in to your TradeGrind simulation terminal</p>
        </div>

        {error && (
          <div className="flex items-center space-x-2 p-3 rounded-16 bg-loss/10 border border-loss/30 text-loss text-xs mb-5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="login-email"
            label="Email Address"
            type="email"
            placeholder="trader@tradegrind.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            id="login-password"
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            disabled={loading}
            icon={<LogIn className="w-4 h-4" />}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </Button>
        </form>

        {/* Quick-fill Sample Accounts */}
        <div className="mt-5 pt-4 border-t border-border">
          <span className="text-[11px] font-semibold text-text-muted block mb-2 uppercase tracking-wider text-center">
            One-Click Demo Personas
          </span>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className="text-[10px] text-text-muted mr-1">Customer:</span>
              <button
                type="button"
                onClick={() => { setEmail('trader@tradegrind.in'); setPassword('Password123!'); }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-surface hover:bg-raised border border-border text-text transition-all"
              >
                Retail Trader
              </button>
              <button
                type="button"
                onClick={() => { setEmail('alex@tradegrind.in'); setPassword('Password123!'); }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-surface hover:bg-raised border border-border text-text transition-all"
              >
                Alex Quant
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className="text-[10px] text-text-muted mr-1">Companies:</span>
              <button
                type="button"
                onClick={() => { setEmail('ceo@infy.sim'); setPassword('Password123!'); }}
                className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent transition-all"
              >
                Infosys (IT)
              </button>
              <button
                type="button"
                onClick={() => { setEmail('ir@hdfc.sim'); setPassword('Password123!'); }}
                className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent transition-all"
              >
                HDFC (Bank)
              </button>
              <button
                type="button"
                onClick={() => { setEmail('corp@reliance.sim'); setPassword('Password123!'); }}
                className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent transition-all"
              >
                Reliance (Energy)
              </button>
              <button
                type="button"
                onClick={() => { setEmail('corp@sunpharma.sim'); setPassword('Password123!'); }}
                className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent transition-all"
              >
                Sun Pharma
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border text-center text-xs text-text-muted">
          Don't have an account?{' '}
          <Link to="/register" className="text-accent hover:underline font-semibold">
            Create an Account
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}

export default Login;
