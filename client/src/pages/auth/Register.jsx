import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { UserPlus, Building2, User, AlertCircle } from 'lucide-react';
import { api } from '../../services/api.js';
import { setCredentials } from '../../store/slices/authSlice.js';
import { GlassCard } from '../../components/ui/GlassCard.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import clsx from 'clsx';

export function Register() {
  const [role, setRole] = useState('CUSTOMER'); // 'CUSTOMER' | 'COMPANY'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Company specific fields
  const [companyName, setCompanyName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [sector, setSector] = useState('Technology');
  const [mu, setMu] = useState(0.12);
  const [sigma, setSigma] = useState(0.25);

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Derive a ticker symbol if left empty (e.g., ACME Innovations -> ACME)
      const cleanSymbol = (symbol.trim() || companyName.replace(/[^a-zA-Z]/g, '').slice(0, 5) || name.replace(/[^a-zA-Z]/g, '').slice(0, 5) || 'TICK')
        .toUpperCase();

      const payload = {
        name,
        email,
        password,
        role,
        ...(role === 'COMPANY'
          ? {
              companyName: companyName || name,
              symbol: cleanSymbol,
              sector,
              mu: Number(mu),
              sigma: Number(sigma)
            }
          : {})
      };

      const data = await api.register(payload);
      dispatch(setCredentials({ user: data.user, token: data.token }));
      if (data.user.role === 'COMPANY') {
        navigate('/company');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const sectors = ['Technology', 'Financial', 'Energy', 'Consumer', 'Healthcare', 'Automotive'];

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-dark-base bg-plum-radial">
      <GlassCard className="w-full max-w-lg p-8 my-8" glow>
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-full bg-mauve-gradient items-center justify-center shadow-glass-glow mb-3">
            <span className="text-dark-base font-black text-2xl">T</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Create an Account</h2>
          <p className="text-xs text-muted mt-1">Select your simulation persona to get started</p>
        </div>

        {/* Role Toggle Pills */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-6">
          <button
            type="button"
            onClick={() => setRole('CUSTOMER')}
            className={clsx(
              'flex items-center justify-center space-x-2 py-2 rounded-full text-xs font-semibold transition-all',
              role === 'CUSTOMER'
                ? 'bg-mauve-pill text-mauve border border-mauve/40 shadow-glass-glow'
                : 'text-muted hover:text-white'
            )}
          >
            <User className="w-4 h-4" />
            <span>Retail Customer</span>
          </button>
          <button
            type="button"
            onClick={() => setRole('COMPANY')}
            className={clsx(
              'flex items-center justify-center space-x-2 py-2 rounded-full text-xs font-semibold transition-all',
              role === 'COMPANY'
                ? 'bg-mauve-pill text-mauve border border-mauve/40 shadow-glass-glow'
                : 'text-muted hover:text-white'
            )}
          >
            <Building2 className="w-4 h-4" />
            <span>Listed Company</span>
          </button>
        </div>

        {error && (
          <div className="flex items-center space-x-2 p-3 rounded-16 bg-trade-red/10 border border-trade-red/30 text-trade-red text-xs mb-5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="reg-name"
            label="Full Name"
            placeholder={role === 'COMPANY' ? 'Executive Representative' : 'Jane Doe'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            id="reg-email"
            label="Email Address"
            type="email"
            placeholder="user@tradesim.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            id="reg-password"
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {role === 'COMPANY' && (
            <div className="p-4 rounded-20 bg-white/[0.03] border border-white/[0.07] space-y-4 pt-4">
              <h4 className="text-xs font-bold text-mauve uppercase tracking-wider">Company & Risk Parameters</h4>

              <Input
                id="reg-company-name"
                label="Company Name"
                placeholder="Acme Innovations Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />

              <Input
                id="reg-company-symbol"
                label="Stock Ticker Symbol (e.g. ACME)"
                placeholder="ACME"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                required
              />

              <Select
                id="reg-sector"
                label="Industry Sector"
                options={sectors}
                value={sector}
                onChange={(e) => setSector(e.target.value)}
              />

              {/* Drift & Volatility Sliders */}
              <div>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>Annualized Drift (mu)</span>
                  <span className="font-mono text-white">{(mu * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.25"
                  step="0.01"
                  value={mu}
                  onChange={(e) => setMu(parseFloat(e.target.value))}
                  className="w-full accent-mauve bg-white/10 rounded-lg cursor-pointer h-1.5"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>Annualized Volatility (sigma)</span>
                  <span className="font-mono text-white">{(sigma * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.15"
                  max="0.50"
                  step="0.01"
                  value={sigma}
                  onChange={(e) => setSigma(parseFloat(e.target.value))}
                  className="w-full accent-mauve bg-white/10 rounded-lg cursor-pointer h-1.5"
                />
              </div>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            disabled={loading}
            icon={<UserPlus className="w-4 h-4" />}
          >
            {loading ? 'Creating Account...' : 'Complete Registration'}
          </Button>
        </form>

        <div className="mt-6 pt-5 border-t border-white/[0.08] text-center text-xs text-muted">
          Already registered?{' '}
          <Link to="/login" className="text-mauve hover:text-mauve-light font-semibold">
            Sign In Here
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}

export default Register;
