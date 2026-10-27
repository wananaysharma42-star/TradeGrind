import React from 'react';
import { Sparkles, ArrowRight, Activity, ShieldCheck } from 'lucide-react';
import { useSelector } from 'react-redux';
import { formatINR } from '../utils/formatters.js';

export default function InsightPromoCard({ onAction, setActiveTab }) {
  const riskMetrics = useSelector(state => state.portfolio.summary.riskMetrics);
  const user = useSelector(state => state.auth.user);
  const isCompany = user?.role === 'COMPANY';

  return (
    <div className="glass-panel p-6 relative overflow-hidden flex flex-col justify-between border border-mauve/20 bg-gradient-to-br from-white/[0.05] to-plumGlow/20">
      {/* Glowing Mauve Arc in top-right */}
      <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-gradient-to-br from-mauve/30 via-mauve-deep/15 to-transparent blur-2xl pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full border border-mauve/25 -mr-10 -mt-10 pointer-events-none opacity-40"></div>
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full border border-mauve/15 -mr-16 -mt-16 pointer-events-none opacity-30"></div>

      <div>
        {/* Header Badge */}
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-mauve/15 border border-mauve/30 text-mauve text-xs font-semibold mb-3">
          <Activity className="w-3.5 h-3.5 text-mauve" />
          <span>{isCompany ? 'Corporate Dynamics' : 'Deterministic Risk Model'}</span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-white tracking-tight leading-snug">
          {isCompany
            ? 'Simulate Dividend & Share Scenarios'
            : 'Portfolio Value at Risk (VaR 95%)'}
        </h3>

        {/* Analytical Insight Body */}
        <p className="text-xs text-muted mt-2 leading-relaxed">
          {isCompany
            ? 'Run deterministic what-if projections over 30 to 252 simulated trading days. Analyze 10th-90th percentile equity corridors.'
            : `1-day Parametric VaR is estimated at ${formatINR(riskMetrics?.valueAtRisk95 || 0)} under 95% confidence with annualized volatility at ${riskMetrics?.estimatedAnnualizedVol || 18}%.`}
        </p>
      </div>

      {/* Actionable Glass Pill Button */}
      <div className="mt-5 pt-3">
        <button
          onClick={() => {
            if (isCompany) {
              setActiveTab('company-simulate');
            } else {
              setActiveTab('targets');
            }
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-mauve-deep to-mauve text-[#0B0709] font-bold text-xs hover:opacity-90 transition-all shadow-glass-glow cursor-pointer"
        >
          <span>{isCompany ? 'Open What-If Simulator' : 'Set Price Target Alert'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
