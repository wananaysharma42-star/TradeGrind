import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { X, Target, Percent, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatINR, formatPercent, getInitials, getStockColor } from '../utils/formatters.js';
import { api } from '../services/api.js';
import { addTarget } from '../store/slices/targetSlice.js';

export default function TargetModal({ isOpen, onClose, initialSymbol = 'RELIANCE' }) {
  const dispatch = useDispatch();
  const stocks = useSelector(state => state.market.stocks);

  const [symbol, setSymbol] = useState(initialSymbol);
  const [targetPrice, setTargetPrice] = useState(0);
  const [deadlineDays, setDeadlineDays] = useState(30);
  const [direction, setDirection] = useState('ABOVE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const selectedStock = stocks.find(s => s.symbol === symbol) || stocks[0];
  const currentPrice = selectedStock?.currentPrice || 1000;

  React.useEffect(() => {
    if (selectedStock && (!targetPrice || targetPrice === 0)) {
      setTargetPrice(Math.round(selectedStock.currentPrice * 1.08 * 100) / 100);
      setDirection('ABOVE');
    }
  }, [selectedStock]);

  if (!isOpen || !selectedStock) return null;

  // Approximate client probability preview indicator
  const T = deadlineDays / 252;
  const mu = selectedStock.mu || 0.12;
  const sigma = selectedStock.sigma || 0.22;
  const isUpside = direction === 'ABOVE';

  let approxProb = 0.5;
  if (currentPrice > 0 && targetPrice > 0 && sigma > 0 && T > 0) {
    const d2 = (Math.log(currentPrice / targetPrice) + (mu - 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    // Simple CDF approximation for preview
    const cdf = 1 / (1 + Math.exp(-1.7 * d2));
    approxProb = isUpside ? cdf : 1 - cdf;
    approxProb = Math.min(0.99, Math.max(0.01, approxProb));
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || targetPrice <= 0) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const created = await api.createTarget({
        symbol: selectedStock.symbol,
        targetPrice: Number(targetPrice),
        direction,
        deadlineDays: Number(deadlineDays)
      });

      dispatch(addTarget(created));

      setFeedback({
        type: 'success',
        message: `Target set for ${selectedStock.symbol} at ${formatINR(targetPrice)}!`
      });

      setTimeout(() => {
        setIsSubmitting(false);
        setFeedback(null);
        onClose();
      }, 1200);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to create target'
      });
      setIsSubmitting(false);
    }
  };

  const logoColor = getStockColor(selectedStock.symbol);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="glass-panel w-full max-w-md p-6 border border-white/15 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-muted hover:text-white p-1 rounded-full glass-panel"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white"
            style={{ backgroundColor: `${logoColor}33`, borderColor: logoColor, borderWidth: '1.5px' }}
          >
            {getInitials(selectedStock.symbol)}
          </div>
          <div>
            <div className="text-base font-bold text-white flex items-center space-x-2">
              <span>Set Target & Alert</span>
            </div>
            <div className="text-xs text-muted">
              Current: <span className="text-white font-semibold">{formatINR(currentPrice)}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Select Simulated Stock</label>
            <select
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                const st = stocks.find(s => s.symbol === e.target.value);
                if (st) setTargetPrice(Math.round(st.currentPrice * 1.08 * 100) / 100);
              }}
              className="w-full glass-input px-3.5 py-2.5 text-white font-semibold text-sm"
            >
              {stocks.map(s => (
                <option key={s.symbol} value={s.symbol} className="bg-[#0B0709] text-white">
                  {s.symbol} • {formatINR(s.currentPrice)} ({s.companyName})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Target Price (₹)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={targetPrice}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTargetPrice(val);
                  setDirection(val >= currentPrice ? 'ABOVE' : 'BELOW');
                }}
                className="w-full glass-input px-3.5 py-2 text-white font-semibold text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">Direction</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                className="w-full glass-input px-3.5 py-2 text-white font-semibold text-sm"
              >
                <option value="ABOVE" className="bg-[#0B0709] text-white">Reach or Exceed (≥)</option>
                <option value="BELOW" className="bg-[#0B0709] text-white">Drop to or Below (≤)</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center text-xs font-medium text-muted mb-1">
              <span>Deadline Horizon</span>
              <span className="text-white font-semibold">{deadlineDays} Simulated Trading Days</span>
            </div>
            <input
              type="range"
              min="1"
              max="180"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(Number(e.target.value))}
              className="w-full accent-mauve cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted mt-1">
              <span>1 Day</span>
              <span>30 Days (1 Mo)</span>
              <span>90 Days (1 Qtr)</span>
              <span>180 Days</span>
            </div>
          </div>

          {/* Mathematical Probability Indicator */}
          <div className="p-4 rounded-20 bg-white/[0.04] border border-mauve/30 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center space-x-1.5">
                <Target className="w-3.5 h-3.5 text-mauve" />
                <span>Deterministic Probability P(Hit)</span>
              </span>
              <span className="text-sm font-bold text-mauve">
                {formatPercent(approxProb * 100)}
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-white/10 h-2 rounded-full mt-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-mauve-deep to-mauve h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.round(approxProb * 100)}%` }}
              ></div>
            </div>
            <div className="text-[10px] text-muted mt-2">
              Computed under Black-Scholes continuous lognormal diffusion with annualized volatility $\sigma = {(sigma * 100).toFixed(0)}\%$.
            </div>
          </div>

          {feedback && (
            <div className={`p-3 rounded-16 flex items-center space-x-2 text-xs ${
              feedback.type === 'success'
                ? 'bg-tradeGreen/15 text-tradeGreen border border-tradeGreen/30'
                : 'bg-tradeRed/15 text-tradeRed border border-tradeRed/30'
            }`}>
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || targetPrice <= 0}
            className="w-full py-3 rounded-full text-xs font-bold bg-gradient-to-r from-mauve-deep to-mauve text-[#0B0709] hover:opacity-90 transition-all shadow-glass-glow flex items-center justify-center space-x-2"
          >
            <Target className="w-4 h-4" />
            <span>{isSubmitting ? 'Creating Target...' : 'Confirm Simulated Target'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
