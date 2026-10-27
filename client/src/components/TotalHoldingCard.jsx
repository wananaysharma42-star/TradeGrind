import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Wallet, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';
import { formatINR, formatPercent } from '../utils/formatters.js';
import { setSelectedPeriod } from '../store/slices/marketSlice.js';

export default function TotalHoldingCard({ onOpenTrade }) {
  const dispatch = useDispatch();
  const summary = useSelector(state => state.portfolio.summary);
  const selectedPeriod = useSelector(state => state.market.selectedPeriod);
  const user = useSelector(state => state.auth.user);

  const isCompany = user?.role === 'COMPANY';
  const periods = ['1D', '1W', '1M', '6M', '1Y'];

  const isProfit = summary.totalUnrealizedPnl >= 0;

  return (
    <div className="glass-panel p-6 relative overflow-hidden flex flex-col justify-between group">
      {/* Warm bronze background ambient glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-accent-deep/15 rounded-full blur-3xl pointer-events-none group-hover:bg-accent/15 transition-all duration-500"></div>

      <div>
        {/* Card Header: Label + Period Pills */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center text-accent">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
              {isCompany ? 'Simulated Market Cap' : 'Total Portfolio Value'}
            </span>
          </div>

          {/* Period selector dropdown pills */}
          <div className="flex items-center space-x-1 bg-surface/80 p-1 rounded-full border border-border">
            {periods.map(period => (
              <button
                key={period}
                onClick={() => dispatch(setSelectedPeriod(period))}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition-all ${
                  selectedPeriod === period
                    ? 'bg-accent/15 text-accent border border-accent/30 shadow-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        {/* Big Bold Balance Number */}
        <div className="my-2">
          <div className="text-3xl md:text-4xl font-bold tracking-tight text-text flex items-baseline">
            {formatINR(summary.totalPortfolioValue)}
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <span className={`inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
              isProfit
                ? 'bg-gain/10 text-gain border-gain/20'
                : 'bg-loss/10 text-loss border-loss/20'
            }`}>
              {isProfit ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{formatINR(Math.abs(summary.totalUnrealizedPnl))}</span>
              <span>({formatPercent(summary.totalUnrealizedPnlPercent)})</span>
            </span>
            <span className="text-[11px] text-text-muted">simulated P&L</span>
          </div>
        </div>
      </div>

      {/* Bottom Sub-stats: Cash vs Invested */}
      <div className="pt-4 mt-4 border-t border-border grid grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] text-text-muted">Virtual Cash Available</div>
          <div className="text-sm font-semibold text-text mt-0.5">
            {formatINR(summary.cashBalance)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-text-muted">Total Stock Valuation</div>
          <div className="text-sm font-semibold text-text mt-0.5">
            {formatINR(summary.totalHoldingsValue)}
          </div>
        </div>
      </div>
    </div>
  );
}
