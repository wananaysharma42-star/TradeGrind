import React from 'react';
import { useSelector } from 'react-redux';
import { ArrowUpRight, ArrowDownRight, Briefcase } from 'lucide-react';
import { formatINR, formatPercent, getInitials, getStockColor } from '../utils/formatters.js';

export default function MyPortfolioTiles({ onSelectStock }) {
  const holdings = useSelector(state => state.portfolio.holdings);
  const user = useSelector(state => state.auth.user);

  const displayHoldings = holdings.slice(0, 4);

  return (
    <div className="glass-panel p-6 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center text-accent">
            <Briefcase className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-text tracking-wide">My Portfolio</h2>
        </div>
        <span className="text-xs text-text-muted font-medium">
          {holdings.length} {holdings.length === 1 ? 'Position' : 'Positions'}
        </span>
      </div>

      {displayHoldings.length === 0 ? (
        <div className="py-8 text-center text-text-muted text-xs">
          No stock holdings yet. Explore the market below to execute simulated orders.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {displayHoldings.map((h) => {
            const isProfit = h.pnl >= 0;
            const logoColor = getStockColor(h.symbol);

            return (
              <div
                key={h.id || h.symbol}
                onClick={() => onSelectStock && onSelectStock(h.symbol)}
                className="glass-tile p-3.5 flex flex-col justify-between cursor-pointer hover:border-accent/40 transition-all rounded-20 border border-border"
              >
                {/* Header: Logo + Symbol + Units */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-text shadow-sm"
                      style={{ backgroundColor: `${logoColor}33`, borderColor: logoColor, borderWidth: '1px' }}
                    >
                      {getInitials(h.symbol)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-text tracking-wide">{h.symbol}</div>
                      <div className="text-[10px] text-text-muted">{h.quantity} units</div>
                    </div>
                  </div>

                  {/* % Change Badge */}
                  <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isProfit ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
                  }`}>
                    {isProfit ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                    {formatPercent(h.pnlPercent)}
                  </span>
                </div>

                {/* Bottom: Current Value */}
                <div className="mt-3">
                  <div className="text-[10px] text-text-muted">Valuation</div>
                  <div className="text-sm font-bold text-text tracking-tight">
                    {formatINR(h.currentValue)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
