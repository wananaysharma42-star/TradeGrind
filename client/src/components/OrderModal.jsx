import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { X, ArrowRightLeft, CheckCircle2, AlertCircle, ShoppingCart } from 'lucide-react';
import { formatINR, getInitials, getStockColor } from '../utils/formatters.js';
import { api } from '../services/api.js';
import { updateVirtualBalance } from '../store/slices/authSlice.js';

export default function OrderModal({ isOpen, onClose, initialSymbol = 'RELIANCE', initialAction = 'BUY' }) {
  const dispatch = useDispatch();
  const stocks = useSelector(state => state.market.stocks);
  const user = useSelector(state => state.auth.user);
  const holdings = useSelector(state => state.portfolio.holdings);

  const [symbol, setSymbol] = useState(initialSymbol);
  const [orderType, setOrderType] = useState('MARKET'); // 'MARKET' | 'LIMIT'
  const [action, setAction] = useState(initialAction);   // 'BUY' | 'SELL'
  const [quantity, setQuantity] = useState(10);
  const [limitPrice, setLimitPrice] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (initialSymbol) setSymbol(initialSymbol);
    if (initialAction) setAction(initialAction);
  }, [initialSymbol, initialAction]);

  const selectedStock = stocks.find(s => s.symbol === symbol) || stocks[0];
  const currentPrice = selectedStock?.currentPrice || 1000;

  useEffect(() => {
    if (selectedStock && (!limitPrice || limitPrice === 0)) {
      setLimitPrice(selectedStock.currentPrice);
    }
  }, [selectedStock]);

  if (!isOpen || !selectedStock) return null;

  const currentHolding = holdings.find(h => h.symbol === symbol);
  const ownedQuantity = currentHolding ? currentHolding.quantity : 0;
  const executionPrice = orderType === 'LIMIT' ? Number(limitPrice) : currentPrice;
  const totalAmount = Math.round(executionPrice * quantity * 100) / 100;
  const availableCash = user?.virtualBalance || 0;

  const canSubmit = action === 'BUY'
    ? availableCash >= totalAmount && quantity > 0
    : ownedQuantity >= quantity && quantity > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const typeStr = `${orderType}_${action}`;
      const payload = {
        symbol: selectedStock.symbol,
        type: typeStr,
        quantity: Number(quantity),
        price: Number(executionPrice)
      };

      const result = await api.placeOrder(payload);

      if (result.balance !== undefined) {
        dispatch(updateVirtualBalance(result.balance));
      }

      setFeedback({
        type: 'success',
        message: `${action} order for ${quantity} shares of ${symbol} placed successfully!`
      });

      setTimeout(() => {
        setIsSubmitting(false);
        setFeedback(null);
        onClose();
      }, 1200);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to place order'
      });
      setIsSubmitting(false);
    }
  };

  const logoColor = getStockColor(selectedStock.symbol);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="glass-panel w-full max-w-md p-6 border border-border shadow-2xl relative bg-raised text-text">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-text-muted hover:text-text p-1.5 rounded-full bg-surface border border-border transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-5">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-text"
            style={{ backgroundColor: `${logoColor}33`, borderColor: logoColor, borderWidth: '1.5px' }}
          >
            {getInitials(selectedStock.symbol)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <select
                value={symbol}
                onChange={(e) => {
                  setSymbol(e.target.value);
                  const st = stocks.find(s => s.symbol === e.target.value);
                  if (st) setLimitPrice(st.currentPrice);
                }}
                className="bg-surface text-text font-bold text-base border border-border rounded-lg px-2 py-0.5 outline-none focus:border-accent"
              >
                {stocks.map(s => (
                  <option key={s.symbol} value={s.symbol} className="bg-raised text-text">
                    {s.symbol} • {formatINR(s.currentPrice)}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-text-muted mt-0.5">{selectedStock.companyName}</div>
          </div>
        </div>

        {/* Buy / Sell Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-surface rounded-full border border-border mb-5">
          <button
            type="button"
            onClick={() => setAction('BUY')}
            className={`py-2 rounded-full text-xs font-bold transition-all ${
              action === 'BUY'
                ? 'bg-gain text-[#0C0A07] shadow-md'
                : 'text-text-muted hover:text-text'
            }`}
          >
            BUY
          </button>
          <button
            type="button"
            onClick={() => setAction('SELL')}
            className={`py-2 rounded-full text-xs font-bold transition-all ${
              action === 'SELL'
                ? 'bg-loss text-[#0C0A07] shadow-md'
                : 'text-text-muted hover:text-text'
            }`}
          >
            SELL
          </button>
        </div>

        {/* Market vs Limit Pills */}
        <div className="flex items-center justify-center space-x-2 mb-5">
          <button
            type="button"
            onClick={() => setOrderType('MARKET')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              orderType === 'MARKET' ? 'glass-pill-active text-accent' : 'glass-pill text-text-muted hover:text-text'
            }`}
          >
            Market Order
          </button>
          <button
            type="button"
            onClick={() => setOrderType('LIMIT')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              orderType === 'LIMIT' ? 'glass-pill-active text-accent' : 'glass-pill text-text-muted hover:text-text'
            }`}
          >
            Limit Order
          </button>
        </div>

        {/* Order Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {orderType === 'LIMIT' && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Limit Price (₹)</label>
              <input
                type="number"
                step="0.05"
                min="0.01"
                value={limitPrice}
                onChange={(e) => setLimitPrice(Number(e.target.value))}
                className="w-full glass-input px-4 py-2.5 text-text font-semibold text-sm"
                required
              />
            </div>
          )}

          <div>
            <div className="flex justify-between items-center text-xs font-medium text-text-muted mb-1">
              <span>Quantity (Shares)</span>
              <span>
                {action === 'BUY'
                  ? `Available Cash: ${formatINR(availableCash)}`
                  : `Owned: ${ownedQuantity} shares`}
              </span>
            </div>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full glass-input px-4 py-2.5 text-text font-semibold text-sm"
              required
            />

            {/* Quick quantity selector pills */}
            <div className="flex items-center space-x-2 mt-2">
              {[10, 25, 50, 100].map(q => (
                <button
                  type="button"
                  key={q}
                  onClick={() => setQuantity(q)}
                  className="px-2.5 py-1 text-[11px] rounded-full glass-pill text-text-muted hover:text-text"
                >
                  +{q}
                </button>
              ))}
              {action === 'BUY' && currentPrice > 0 && (
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, Math.floor(availableCash / currentPrice)))}
                  className="px-2.5 py-1 text-[11px] rounded-full glass-pill text-accent hover:underline font-semibold"
                >
                  Max Cash
                </button>
              )}
              {action === 'SELL' && ownedQuantity > 0 && (
                <button
                  type="button"
                  onClick={() => setQuantity(ownedQuantity)}
                  className="px-2.5 py-1 text-[11px] rounded-full glass-pill text-accent hover:underline font-semibold"
                >
                  All Shares
                </button>
              )}
            </div>
          </div>

          {/* Execution Summary Breakdown */}
          <div className="p-3.5 rounded-16 bg-surface border border-border space-y-1.5 text-xs">
            <div className="flex justify-between text-text-muted">
              <span>Est. Execution Price</span>
              <span className="text-text font-medium">{formatINR(executionPrice)}</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>Total Value</span>
              <span className="text-text font-bold text-sm">{formatINR(totalAmount)}</span>
            </div>
          </div>

          {feedback && (
            <div className={`p-3 rounded-16 flex items-center space-x-2 text-xs ${
              feedback.type === 'success'
                ? 'bg-gain/15 text-gain border border-gain/30'
                : 'bg-loss/15 text-loss border border-loss/30'
            }`}>
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className={`w-full py-3 rounded-full text-sm font-bold flex items-center justify-center space-x-2 transition-all ${
              !canSubmit
                ? 'bg-surface text-text-disabled cursor-not-allowed border border-border'
                : action === 'BUY'
                ? 'bg-gain text-[#0C0A07] hover:bg-gain/90 shadow-glass-glow'
                : 'bg-loss text-[#0C0A07] hover:bg-loss/90 shadow-glass-glow'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Executing...'
                : !canSubmit
                ? action === 'BUY' ? 'Insufficient Funds' : 'Insufficient Shares'
                : `Execute ${orderType} ${action}`}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
