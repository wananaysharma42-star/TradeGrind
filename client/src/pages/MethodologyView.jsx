import React from 'react';
import {
  Binary,
  Compass,
  Cpu,
  Layers,
  Activity,
  Calculator,
  ShieldAlert,
  Percent,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard.jsx';

export function MethodologyView() {
  const formulas = [
    {
      title: '1. Geometric Brownian Motion (GBM)',
      category: 'Asset Price Dynamics',
      latex: 'S_{t+\\Delta t} = S_t \\exp\\left(\\left(\\mu - \\frac{1}{2}\\sigma^2\\right)\\Delta t + \\sigma\\sqrt{\\Delta t} \\, Z\\right)',
      variables: [
        { sym: 'S_t', desc: 'Asset price at simulated time t' },
        { sym: '\\mu', desc: 'Annualized expected rate of return (drift)' },
        { sym: '\\sigma', desc: 'Annualized volatility standard deviation' },
        { sym: '\\Delta t', desc: 'Time step: 1 second per tick = 1/390 simulated day = 1/98,280 trading year' },
        { sym: 'Z', desc: 'Standard normal variate N(0, 1) generated via Box-Muller transform' }
      ],
      description: 'The foundation of TradeSim stochastic asset price generation. Ensures log returns are normally distributed and asset prices remain strictly positive.'
    },
    {
      title: '2. Closed-Form Terminal Probability',
      category: 'Probability Evaluation',
      latex: 'P(S_T \\ge K) = N(d_2), \\quad d_2 = \\frac{\\ln(S_0/K) + \\left(\\mu - \\frac{1}{2}\\sigma^2\\right)T}{\\sigma\\sqrt{T}}',
      variables: [
        { sym: 'K', desc: 'Target price threshold' },
        { sym: 'S_0', desc: 'Current starting asset price' },
        { sym: 'T', desc: 'Time to horizon in years (deadlineDays / 252)' },
        { sym: 'N(x)', desc: 'Standard normal cumulative distribution approximated via Abramowitz-Stegun 7.1.26' }
      ],
      description: 'Evaluates the exact probability that an equity price finishes at or above (or below for downward targets) the target strike price at terminal expiry.'
    },
    {
      title: '3. Closed-Form First-Touch Barrier Probability',
      category: 'First Hitting Times',
      latex: 'P(\\tau_K \\le T) = N\\left(\\frac{-b + \\nu T}{\\sigma\\sqrt{T}}\\right) + \\exp\\left(\\frac{2\\nu b}{\\sigma^2}\\right) N\\left(\\frac{-b - \\nu T}{\\sigma\\sqrt{T}}\\right)',
      variables: [
        { sym: 'b', desc: '\\ln(K / S_0) > 0 \\text{ (distance to upper barrier in log space)}' },
        { sym: '\\nu', desc: '\\mu - \\frac{1}{2}\\sigma^2 \\text{ (drift of Brownian motion with drift)}' },
        { sym: '\\tau_K', desc: '\\inf \\{ t \\ge 0 : S_t \\ge K \\} \\text{ (first hitting time)}' }
      ],
      description: 'Derived via Brownian motion reflection principle with continuous drift. Accurately predicts intraday barrier touch prior to expiration.'
    },
    {
      title: '4. Exponentially Weighted Moving Average (EWMA) Volatility',
      category: 'Parameter Estimation',
      latex: '\\sigma_t^2 = (1 - \\lambda) \\sum_{i=1}^M \\lambda^{i-1} (r_{t-i} - \\bar{r})^2, \\quad \\sigma_{\\text{blended}} = 0.5\\,\\sigma_{\\text{sample}} + 0.5\\,\\sigma_{\\text{EWMA}}',
      variables: [
        { sym: '\\lambda', desc: 'Decay parameter (RiskMetrics standard = 0.94)' },
        { sym: 'r_t', desc: 'Logarithmic daily return \\ln(S_t / S_{t-1})' },
        { sym: '\\sigma_{\\text{blended}}', desc: 'Equal 50/50 blend of 30-day sample standard deviation and EWMA volatility' }
      ],
      description: 'Gives greater weight to recent volatility shocks without discarding medium-term regime stability.'
    },
    {
      title: '5. Value at Risk (VaR) & Expected Shortfall (CVaR)',
      category: 'Downside Risk Telemetry',
      latex: '\\text{VaR}_{\\alpha} = V_0 \\left(1 - \\exp\\left(\\left(\\mu - \\frac{1}{2}\\sigma^2\\right)\\Delta t - \\sigma\\sqrt{\\Delta t}\\, z_\\alpha\\right)\\right), \\quad \\text{CVaR}_\\alpha = E[L \\mid L \\ge \\text{VaR}_\\alpha]',
      variables: [
        { sym: 'V_0', desc: 'Portfolio or asset value in base currency' },
        { sym: '\\alpha', desc: 'Confidence level (95% standard)' },
        { sym: 'z_\\alpha', desc: 'Quantile of standard normal distribution (1.64485 for 95%)' },
        { sym: '\\text{CVaR}', desc: 'Conditional Value at Risk (average expected loss beyond the VaR threshold)' }
      ],
      description: 'Calculated using both closed-form parametric lognormal formulations and empirical non-parametric historical simulation.'
    },
    {
      title: '6. Risk-Adjusted Return Ratios (Sharpe & Sortino)',
      category: 'Portfolio Performance',
      latex: '\\text{Sharpe} = \\frac{R_p - R_f}{\\sigma_p \\sqrt{252}}, \\quad \\text{Sortino} = \\frac{R_p - R_f}{\\sigma_{\\text{down}} \\sqrt{252}}',
      variables: [
        { sym: 'R_p', desc: 'Annualized portfolio average return' },
        { sym: 'R_f', desc: 'Risk-free benchmark rate (configured at 6.0% p.a.)' },
        { sym: '\\sigma_{\\text{down}}', desc: '\\sqrt{\\frac{1}{N}\\sum_{r_i < 0} r_i^2} \\text{ (downside semi-deviation)}' }
      ],
      description: 'Sortino penalizes only harmful downside volatility while Sharpe evaluates overall variance efficiency.'
    },
    {
      title: '7. Relative Strength Index (RSI-14)',
      category: 'Technical Momentum Signals',
      latex: '\\text{RSI} = 100 - \\frac{100}{1 + \\text{RS}}, \\quad \\text{RS} = \\frac{\\text{Smoothed Average Gain}}{\\text{Smoothed Average Loss}}',
      variables: [
        { sym: 'N', desc: 'Standard 14-period lookback window' },
        { sym: '\\text{Wilder}', desc: '\\text{AvgGain}_t = \\frac{\\text{AvgGain}_{t-1} \\times 13 + \\text{Gain}_t}{14}' }
      ],
      description: 'Deterministic bounded momentum oscillator indicating overbought (> 70) and oversold (< 30) states.'
    },
    {
      title: '8. Composite Quant Scoring Weightings',
      category: 'Cross-Sectional Ranking',
      latex: '\\text{Score} = 0.35\\,S_{\\text{Momentum}} + 0.25\\,S_{\\text{Sharpe}} + 0.20\\,S_{\\text{Drawdown}} + 0.20\\,S_{\\text{LowVol}}',
      variables: [
        { sym: 'S_{\\text{Momentum}}', desc: '30-day cumulative logarithmic return percentile rank (35% weight)' },
        { sym: 'S_{\\text{Sharpe}}', desc: 'Risk-adjusted Sharpe ratio percentile rank (25% weight)' },
        { sym: 'S_{\\text{Drawdown}}', desc: 'Drawdown resilience score: 1 - |MaxDrawdown| (20% weight)' },
        { sym: 'S_{\\text{LowVol}}', desc: 'Low-volatility inverse variance rank (20% weight)' }
      ],
      description: 'Normalizes all cross-sectional stock metrics across the universe into an explainable 0 to 100 rating.'
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Banner */}
      <GlassCard className="p-8" glow>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-plum-glow/20 border border-plum-glow/40 text-plum-white text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-plum-glow" />
              Mathematical Proofs & Stochastic Foundations
            </div>
            <h1 className="text-3xl font-extrabold text-plum-white tracking-tight">
              TradeSim Quantitative Methodology
            </h1>
            <p className="text-sm text-plum-light/80 max-w-2xl">
              Every price movement, probability target, risk metric, and ranking score is derived from
              deterministic mathematical formulations without external heuristic bias.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-4 rounded-2xl bg-white/5 border border-glass-border text-center">
              <span className="text-[11px] text-plum-light/60 block">Stochastic Engine</span>
              <span className="text-base font-bold text-plum-white font-mono">GBM 1,000ms</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-glass-border text-center">
              <span className="text-[11px] text-plum-light/60 block">MC Precision</span>
              <span className="text-base font-bold text-trade-green font-mono">20,000 Paths</span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Formula Cards */}
      <div className="grid grid-cols-1 gap-6">
        {formulas.map((f, idx) => (
          <GlassCard key={idx} className="p-6 space-y-4 hover:border-plum-glow/40 transition-all">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h2 className="text-lg font-bold text-plum-white">{f.title}</h2>
              <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-plum-light">
                {f.category}
              </span>
            </div>

            {/* Formula Block */}
            <div className="p-4 rounded-2xl bg-dark-base/80 border border-glass-border font-mono text-sm text-plum-white shadow-inner overflow-x-auto">
              <code>{f.latex}</code>
            </div>

            <p className="text-xs text-plum-light/90 leading-relaxed">{f.description}</p>

            {/* Variable Table */}
            <div className="pt-3 border-t border-glass-border space-y-1.5">
              <span className="text-[11px] font-bold text-plum-light/60 uppercase tracking-wider block mb-1">
                Mathematical Notation
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {f.variables.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02]">
                    <span className="font-mono font-bold text-plum-glow shrink-0">{v.sym}:</span>
                    <span className="text-plum-light/80 text-[11px]">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
