import React, { useEffect, useState } from 'react';
import { X, ArrowRightLeft, TrendingUp, TrendingDown, Activity, Layers } from 'lucide-react';
import { formatINR, formatPercent, getInitials, getStockColor } from '../utils/formatters.js';
import { api } from '../services/api.js';
import { subscribeToStock, unsubscribeFromStock } from '../services/socket.js';
import PortfolioPerformanceChart from './PortfolioPerformanceChart.jsx';

export default function StockDetailModal({ symbol, isOpen, onClose, onOpenTrade }) {
  const [stockDetail, setStockDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol || !isOpen) return;

    let mounted = true;
    setLoading(true);

    async function load() {
      try {
        const data = await api.getStock(symbol);
        if (mounted) {
          setStockDetail(data);
          subscribeToStock(symbol);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
      unsubscribeFromStock(symbol);
    };
  }, [symbol, isOpen]);

  if (!isOpen || !symbol) return null;

  const logoColor = getStockColor(symbol);
  const isGain = stockDetail ? stockDetail.dayChange >= 0 : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="glass-panel w-full max-w-2xl p-6 border border-border shadow-2xl relative max-h-[90vh] overflow-y-auto bg-raised text-text">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-text-muted hover:text-text p-1.5 rounded-full bg-surface border border-border z-10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {loading || !stockDetail ? (
          <div className="py-20 text-center text-text-muted text-sm">
            Fetching continuous simulated market feed for {symbol}...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pr-10">
              <div className="flex items-center space-x-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base text-text shadow-glass-glow"
                  style={{ backgroundColor: `${logoColor}33`, borderColor: logoColor, borderWidth: '2px' }}
                >
                  {getInitials(stockDetail.symbol)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xl font-bold text-text tracking-tight">{stockDetail.symbol}</h2>
                    <span className="text-xs text-text-muted font-normal bg-surface px-2 py-0.5 rounded-full border border-border">
                      {stockDetail.sector}
                    </span>
                  </div>
                  <div className="text-xs text-text-muted">{stockDetail.companyName}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl font-bold text-text tracking-tight">
                  {formatINR(stockDetail.currentPrice)}
                </div>
                <div className={`text-xs font-semibold flex items-center justify-end space-x-1 ${
                  isGain ? 'text-gain' : 'text-loss'
                }`}>
                  {isGain ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{formatPercent(stockDetail.dayChangePercent)}</span>
                </div>
              </div>
            </div>

            {/* Performance Curve */}
            <div>
              <PortfolioPerformanceChart activeStock={stockDetail} />
            </div>

            {/* Technical Indicators Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="glass-tile p-3 rounded-16 border border-border bg-surface/50">
                <div className="text-[10px] text-text-muted uppercase">Wilder's RSI (14)</div>
                <div className="text-sm font-bold text-text mt-0.5 flex items-center space-x-1.5">
                  <span>{stockDetail.technicals?.rsi14 || 50}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    stockDetail.technicals?.rsi14 > 70 ? 'bg-loss/20 text-loss' :
                    stockDetail.technicals?.rsi14 < 30 ? 'bg-gain/20 text-gain' :
                    'bg-surface text-text-muted'
                  }`}>
                    {stockDetail.technicals?.rsi14 > 70 ? 'Overbought' : stockDetail.technicals?.rsi14 < 30 ? 'Oversold' : 'Neutral'}
                  </span>
                </div>
              </div>

              <div className="glass-tile p-3 rounded-16 border border-border bg-surface/50">
                <div className="text-[10px] text-text-muted uppercase">SMA (20)</div>
                <div className="text-sm font-bold text-text mt-0.5">
                  {formatINR(stockDetail.technicals?.sma20 || stockDetail.currentPrice)}
                </div>
              </div>

              <div className="glass-tile p-3 rounded-16 border border-border bg-surface/50">
                <div className="text-[10px] text-text-muted uppercase">MACD Histogram</div>
                <div className={`text-sm font-bold mt-0.5 ${
                  (stockDetail.technicals?.macd?.histogram || 0) >= 0 ? 'text-gain' : 'text-loss'
                }`}>
                  {stockDetail.technicals?.macd?.histogram || 0}
                </div>
              </div>

              <div className="glass-tile p-3 rounded-16 border border-border bg-surface/50">
                <div className="text-[10px] text-text-muted uppercase">Bollinger Bandwidth</div>
                <div className="text-sm font-bold text-accent mt-0.5">
                  {stockDetail.technicals?.bollinger?.bandwidth || 5}%
                </div>
              </div>
            </div>

            {/* Market Depth Summary */}
            <div className="grid grid-cols-3 gap-3 p-3 rounded-20 bg-surface border border-border text-xs">
              <div>
                <span className="text-text-muted block text-[10px]">Day High / Low</span>
                <span className="font-semibold text-text">{formatINR(stockDetail.dayHigh)} / {formatINR(stockDetail.dayLow)}</span>
              </div>
              <div>
                <span className="text-text-muted block text-[10px]">Volume</span>
                <span className="font-semibold text-text">{stockDetail.volume?.toLocaleString('en-IN')} shares</span>
              </div>
              <div>
                <span className="text-text-muted block text-[10px]">Market Cap</span>
                <span className="font-semibold text-text">{formatINR(stockDetail.marketCap, true)}</span>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenTrade(stockDetail.symbol);
                }}
                className="w-full py-3 rounded-full text-xs font-bold bg-accent text-[#0C0A07] hover:bg-accent/90 transition-all flex items-center justify-center space-x-2 shadow-glass-glow cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Trade {stockDetail.symbol}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
