import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { LineChart, ArrowUpRight, ArrowDownRight, ArrowRightLeft } from 'lucide-react';
import { setFilter } from '../store/slices/marketSlice.js';
import { formatINR, formatPercent, getInitials, getStockColor } from '../utils/formatters.js';

export default function WatchlistCard({ onSelectStock, onOpenTrade }) {
  const dispatch = useDispatch();
  const stocks = useSelector(state => state.market.stocks);
  const filter = useSelector(state => state.market.filter);
  const searchQuery = useSelector(state => state.market.searchQuery);
  const priceFlashes = useSelector(state => state.market.priceFlashes);

  const filterTabs = [
    { id: 'ALL', label: 'All Stocks' },
    { id: 'GAINERS', label: 'Gainers' },
    { id: 'LOSERS', label: 'Losers' },
    { id: 'VOLUME', label: 'High Vol' }
  ];

  // Apply search query and category filters
  let filtered = [...stocks];

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(s =>
      s.symbol.toLowerCase().includes(q) ||
      s.companyName.toLowerCase().includes(q) ||
      s.sector.toLowerCase().includes(q)
    );
  }

  if (filter === 'GAINERS') {
    filtered = filtered.filter(s => s.dayChangePercent > 0).sort((a, b) => b.dayChangePercent - a.dayChangePercent);
  } else if (filter === 'LOSERS') {
    filtered = filtered.filter(s => s.dayChangePercent < 0).sort((a, b) => a.dayChangePercent - b.dayChangePercent);
  } else if (filter === 'VOLUME') {
    filtered = filtered.sort((a, b) => b.volume - a.volume);
  }

  return (
    <div className="glass-panel p-6 flex flex-col justify-between">
      {/* Header: Title + Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-mauve">
            <LineChart className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white tracking-wide">Live Watchlist</h2>
            <div className="text-[11px] text-muted">NSE / BSE Simulated Continuous Feed</div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1 bg-black/20 p-1 rounded-full border border-white/[0.06] overflow-x-auto">
          {filterTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => dispatch(setFilter(tab.id))}
              className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-all ${
                filter === tab.id
                  ? 'bg-mauve/20 text-mauve-light border border-mauve/30 shadow-sm'
                  : 'text-muted hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stock Rows List */}
      <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-muted text-xs">
            No stocks matched your search filter.
          </div>
        ) : (
          filtered.map(stock => {
            const isGain = stock.dayChange >= 0;
            const logoColor = getStockColor(stock.symbol);
            const flash = priceFlashes[stock.symbol];

            return (
              <div
                key={stock.symbol}
                className={`flex items-center justify-between p-3 rounded-20 glass-tile transition-all duration-300 border border-white/[0.06] hover:border-mauve/40 ${
                  flash === 'green' ? 'bg-tradeGreen/20 border-tradeGreen/40' :
                  flash === 'red' ? 'bg-tradeRed/20 border-tradeRed/40' : ''
                }`}
              >
                {/* Left: Logo-circle + Symbol + Company & Sector */}
                <div
                  className="flex items-center space-x-3 cursor-pointer flex-1"
                  onClick={() => onSelectStock && onSelectStock(stock.symbol)}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-inner shrink-0"
                    style={{ backgroundColor: `${logoColor}26`, borderColor: logoColor, borderWidth: '1.5px' }}
                  >
                    {getInitials(stock.symbol)}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <span>{stock.symbol}</span>
                      <span className="text-[10px] text-muted font-normal">NSE</span>
                    </div>
                    <div className="text-[11px] text-muted truncate max-w-[150px] sm:max-w-[200px]">
                      {stock.companyName}
                    </div>
                  </div>
                </div>

                {/* Right: Live Price + Coloured % Change + Trade Button */}
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm font-bold text-white tabular-nums tracking-tight">
                      {formatINR(stock.currentPrice)}
                    </div>
                    <div className={`text-[11px] font-semibold flex items-center justify-end space-x-0.5 ${
                      isGain ? 'text-tradeGreen' : 'text-tradeRed'
                    }`}>
                      {isGain ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      <span>{formatPercent(stock.dayChangePercent)}</span>
                    </div>
                  </div>

                  {/* Trade Action Pill */}
                  <button
                    onClick={() => onOpenTrade && onOpenTrade(stock.symbol)}
                    className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-mauve hover:text-[#0B0709] text-xs font-semibold text-white border border-white/10 transition-all flex items-center space-x-1 shadow-sm"
                    title="Trade stock"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>Trade</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
