import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Cpu,
  BarChart3,
  ShieldAlert,
  ArrowRight,
  Zap,
  Lock,
  Layers,
  ChevronRight
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Badge } from '../components/ui/StatTile.jsx';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-dark-base bg-plum-radial text-white overflow-x-hidden">
      {/* Header / Navbar */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto border-b border-white/[0.06]">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-9 h-9 rounded-full bg-mauve-gradient flex items-center justify-center shadow-glass-glow">
            <span className="text-dark-base font-black text-lg">T</span>
          </div>
          <div>
            <span className="text-base font-bold text-white tracking-wider">TRADE</span>
            <span className="text-base font-light text-mauve ml-1">GRIND</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
            Sign In
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/register')}>
            Get Started
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
        {/* Plum Glow Orb in Background */}
        <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 w-96 h-96 bg-mauve/20 rounded-full blur-[120px] -z-10" />

        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md mb-6">
          <Badge variant="mauve" size="sm">LIVE SIMULATION ENGINE</Badge>
          <span className="text-xs text-muted">Closed-Form Probability • Geometric Brownian Motion</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight max-w-3xl mx-auto">
          Quantitative Trading with <span className="text-transparent bg-clip-text bg-gradient-to-r from-mauve to-mauve-light">Exact Maths</span>
        </h1>

        <p className="text-base sm:text-lg text-muted max-w-2xl mx-auto mt-6 leading-relaxed">
          Simulated market prices advancing every 1,000 ms. Monte Carlo fan charts, closed-form touch probabilities, and institutional-grade portfolio risk modeling without financial guessing.
        </p>

        {/* Dual CTAs for Customer & Company */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <Button
            variant="primary"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => navigate('/register')}
            icon={<ArrowRight className="w-5 h-5" />}
          >
            Enter as Retail Customer
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => navigate('/register')}
          >
            Join as Listed Company
          </Button>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-white/[0.06]">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">How TradeGrind Works</h2>
          <p className="text-xs sm:text-sm text-muted mt-2">Designed for institutional transparency and mathematical rigor</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GlassCard hoverEffect>
            <div className="w-10 h-10 rounded-full bg-mauve/20 border border-mauve/40 flex items-center justify-center text-mauve mb-4">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">1. Real-Time Engine</h3>
            <p className="text-xs text-muted leading-relaxed">
              Every second, all stock prices step forward via seeded GBM dynamics. Intraday sparklines and price ticks update continuously.
            </p>
          </GlassCard>

          <GlassCard hoverEffect>
            <div className="w-10 h-10 rounded-full bg-mauve/20 border border-mauve/40 flex items-center justify-center text-mauve mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">2. Transparent Probabilities</h3>
            <p className="text-xs text-muted leading-relaxed">
              Set target price goals. The math library calculates closed-form touch/terminal probabilities and Monte Carlo fan chart percentile cones.
            </p>
          </GlassCard>

          <GlassCard hoverEffect>
            <div className="w-10 h-10 rounded-full bg-mauve/20 border border-mauve/40 flex items-center justify-center text-mauve mb-4">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">3. Institutional Analytics</h3>
            <p className="text-xs text-muted leading-relaxed">
              Calculate exact portfolio Sharpe ratios, Sortino ratios, 95% 1-day VaR, CVaR, and multi-factor company rank percentiles.
            </p>
          </GlassCard>
        </div>
      </section>

      {/* Transparent Maths Banner */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <GlassCard className="p-8 sm:p-12 text-center" glow>
          <Badge variant="mauve" size="sm" className="mb-4">ZERO BLACK BOXES</Badge>
          <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">
            Transparent Maths: Every number is computed, nothing is guessed.
          </h2>
          <p className="text-xs sm:text-sm text-muted max-w-2xl mx-auto leading-relaxed mb-6">
            Parameters for customer analysis are estimated exclusively from the stock's last 30 simulated days using EWMA and sample volatility blending, preserving hidden true engine drift.
          </p>
          <Button variant="outline" size="md" onClick={() => navigate('/register')}>
            Explore Mathematical Models
          </Button>
        </GlassCard>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 text-center text-xs text-muted">
        TradeGrind Quantitative Trading Simulation Engine • Educational & Research Terminal
      </footer>
    </div>
  );
}

export default LandingPage;
