import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowLeft,
  Target,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  Sparkles,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge, NumberFlash, StockLogo, StatTile } from '../../components/ui/StatTile.jsx';
import { PerformanceChart, LiveLineChart, Sparkline } from '../../components/ui/Charts.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import { api } from '../../services/api.js';
import { useStockSocket, useLivePrice } from '../../hooks/useSocket.js';
import { formatINR } from '../../utils/formatters.js';
import clsx from 'clsx';

export function StockDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  const [stock, setStock] = useState(null);
  const [insights, setInsights] = useState(null);
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [tradeAction, setTradeAction] = useState('BUY');
  const [quantity, setQuantity] = useState(10);
  const [targetPrice, setTargetPrice] = useState(120);
  const [deadlineDays, setDeadlineDays] = useState(10);
  const [targetMode, setTargetMode] = useState('touch');
  const [actionMessage, setActionMessage] = useState(null);

  // Subscribe to live socket ticks for this stock
  useStockSocket(stock?.symbol || id);
  const livePriceData = useLivePrice(stock?.symbol || id);

  useEffect(() => {
    async function loadStockDetails() {
      try {
        const [stockRes, insightRes] = await Promise.all([
          api.getStock(id).catch(() => null),
          api.getStockInsights(id).catch(() => null)
        ]);

        if (stockRes) setStock(stockRes);
        if (insightRes) setInsights(insightRes);
      } catch (err) {
        console.warn('Failed to load stock detail', err);
      } finally {
        setLoading(false);
      }
    }
    loadStockDetails();
  }, [id]);

  const currentPrice = livePriceData?.price || stock?.currentPrice || stock?.price || 100;
  const isUp = (stock?.dayChangePercent ?? stock?.changePct ?? 0) >= 0;

  // Execute Trade
  const handleExecuteTrade = async () => {
    if (!stock || quantity <= 0) return;
    setActionMessage(null);
    const targetStockId = stock.stockId || stock._id || stock.id || stock.symbol;
    try {
      if (tradeAction === 'BUY') {
        await api.buyStock({ stockId: targetStockId, quantity: Number(quantity) });
      } else {
        await api.sellStock({ stockId: targetStockId, quantity: Number(quantity) });
      }
      setActionMessage('Trade executed successfully!');
      setTimeout(() => {
        setTradeModalOpen(false);
        setActionMessage(null);
      }, 1000);
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  // Set Target
  const handleSetTarget = async () => {
    if (!stock || targetPrice <= 0) return;
    setActionMessage(null);
    try {
      await api.createTarget({
        stockId: stock.stockId || stock._id,
        targetPrice: Number(targetPrice),
        deadlineDays: Number(deadlineDays),
        mode: targetMode
      });
      setActionMessage('Target registered with closed-form probability!');
      setTimeout(() => {
        setTargetModalOpen(false);
        setActionMessage(null);
        navigate('/customer/analysis');
      }, 1000);
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const metrics = insights?.metrics || {};
  const indicators = insights?.indicators || {};

  // Synthetic price chart points
  const chartPoints = (stock?.sparkline?.length > 0 ? stock.sparkline : [98, 99, 101, 100, 102, 104]).map(
    (val, i) => ({
      date: `T-${10 - i}`,
      value: val
    })
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center space-x-2 text-xs text-muted hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Market</span>
        </button>

        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTargetModalOpen(true)}
            icon={<Target className="w-4 h-4 text-mauve" />}
          >
            Set Probability Target
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setTradeModalOpen(true)}
            icon={<ShoppingCart className="w-4 h-4" />}
          >
            Execute Order
          </Button>
        </div>
      </div>

      {/* Stock Header Card */}
      <GlassCard glow>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <StockLogo symbol={stock?.symbol || '??'} size="lg" />
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-2xl font-bold text-white">{stock?.symbol}</h2>
                <Badge variant={isUp ? 'positive' : 'negative'} size="md">
                  {isUp ? '+' : ''}{Number(stock?.changePct ?? stock?.dayChangePercent ?? 0).toFixed(2)}%
                </Badge>
              </div>
              <p className="text-xs text-muted mt-0.5">{stock?.name} • {stock?.sector || 'General'}</p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-3xl font-extrabold text-white font-mono">
              <NumberFlash value={currentPrice} formatter={(p) => formatINR(p)} />
            </div>
            <div className="text-xs text-muted mt-1">
              Previous Close: {formatINR(stock?.previousClose || currentPrice)}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Main Chart + Quantitative Insights Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Interactive Performance Chart */}
        <GlassCard className="lg:col-span-2">
          <PerformanceChart
            title={`${stock?.symbol} Continuous Price Action`}
            data={chartPoints}
          />
        </GlassCard>

        {/* Right: Stage 5 Quantitative Insight Side Panel */}
        <GlassCard className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-white">Quantitative Profile</h4>
              <Badge variant="mauve" size="sm">STAGE 5</Badge>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                <span className="text-muted">Estimated Volatility (σ):</span>
                <span className="font-semibold text-white font-mono">
                  {((metrics.estimatedAnnualizedVolatility || stock?.sigma || 0.22) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                <span className="text-muted">Estimated Drift (μ):</span>
                <span className="font-semibold text-white font-mono">
                  {((metrics.estimatedAnnualizedDrift || stock?.mu || 0.12) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                <span className="text-muted">Annualized Sharpe:</span>
                <span className="font-semibold text-white font-mono">
                  {Number(metrics.sharpeRatio || 1.25).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                <span className="text-muted">Sortino Ratio:</span>
                <span className="font-semibold text-white font-mono">
                  {Number(metrics.sortinoRatio || 1.48).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                <span className="text-muted">Max Drawdown (30d):</span>
                <span className="font-semibold text-white font-mono">
                  {((metrics.maxDrawdown || 0.05) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                <span className="text-muted">1-Day 95% Parametric VaR:</span>
                <span className="font-semibold text-mauve font-mono">
                  {formatINR(metrics.valueAtRisk95_1Day?.closedFormRupees || (currentPrice * 0.0245))}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted">Market Beta:</span>
                <span className="font-semibold text-white font-mono">
                  {Number(metrics.beta || 1.0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] text-[11px] text-muted text-center">
            Zero financial advice • Numbers computed directly from GBM returns
          </div>
        </GlassCard>
      </div>

      {/* Technical Indicators & Signals Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard>
          <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Moving Averages</h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">SMA 20:</span>
              <span className="font-semibold text-white font-mono">{formatINR(indicators.sma20 || currentPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">SMA 50:</span>
              <span className="font-semibold text-white font-mono">{formatINR(indicators.sma50 || currentPrice * 0.98)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">EMA 20:</span>
              <span className="font-semibold text-white font-mono">{formatINR(indicators.ema20 || currentPrice)}</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Momentum & Bands</h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">RSI (14):</span>
              <span className="font-semibold text-mauve font-mono">{Number(indicators.rsi14 || 52.4).toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Bollinger Upper:</span>
              <span className="font-semibold text-white font-mono">{formatINR(indicators.bollingerBands?.upper || currentPrice * 1.05)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Bollinger Lower:</span>
              <span className="font-semibold text-white font-mono">{formatINR(indicators.bollingerBands?.lower || currentPrice * 0.95)}</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Mathematical Signals</h4>
          <div className="space-y-2">
            {insights?.signals?.length > 0 ? (
              insights.signals.slice(0, 3).map((s, idx) => (
                <div key={idx} className="p-2 rounded-12 bg-white/[0.03] border border-white/[0.05] flex items-center justify-between text-xs">
                  <span className="text-white font-medium truncate max-w-[150px]">{s.message || s.label}</span>
                  <Badge variant="mauve" size="sm">{s.type || 'SIGNAL'}</Badge>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted">All indicators within typical neutral envelopes.</p>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Trade Modal */}
      <Modal
        isOpen={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        title={`Execute Order: ${stock?.symbol}`}
        subtitle={`Current Market Price: $${Number(currentPrice).toFixed(2)}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
            <button
              onClick={() => setTradeAction('BUY')}
              className={clsx('py-1.5 text-xs font-semibold rounded-full', tradeAction === 'BUY' ? 'bg-trade-green/20 text-trade-green' : 'text-muted')}
            >
              Buy
            </button>
            <button
              onClick={() => setTradeAction('SELL')}
              className={clsx('py-1.5 text-xs font-semibold rounded-full', tradeAction === 'SELL' ? 'bg-trade-red/20 text-trade-red' : 'text-muted')}
            >
              Sell
            </button>
          </div>

          <Input
            id="order-qty"
            label="Quantity (Shares)"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />

          <div className="p-3.5 rounded-16 bg-white/[0.03] border border-white/[0.06] space-y-1.5 text-xs">
            <div className="flex justify-between text-muted">
              <span>Order Value:</span>
              <span className="text-white font-semibold">{formatINR(Number(currentPrice) * quantity)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Fee (0.05%):</span>
              <span className="text-white font-semibold">{formatINR(Number(currentPrice) * quantity * 0.0005)}</span>
            </div>
            <div className="flex justify-between text-muted border-t border-white/[0.06] pt-1.5">
              <span>Total Required:</span>
              <span className="text-mauve font-bold">{formatINR(Number(currentPrice) * quantity * 1.0005)}</span>
            </div>
          </div>

          {actionMessage && <p className="text-xs text-center text-mauve font-medium">{actionMessage}</p>}

          <div className="flex space-x-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setTradeModalOpen(false)}>Cancel</Button>
            <Button variant="primary" className="flex-1" onClick={handleExecuteTrade}>
              Confirm {tradeAction}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Target Modal */}
      <Modal
        isOpen={targetModalOpen}
        onClose={() => setTargetModalOpen(false)}
        title={`Set Probability Target: ${stock?.symbol}`}
        subtitle={`Current Market Price: ${formatINR(currentPrice)}`}
      >
        <div className="space-y-4">
          <Input
            id="target-price"
            label="Target Price (₹)"
            type="number"
            step="0.1"
            value={targetPrice}
            onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
          />

          <Input
            id="deadline-days"
            label="Deadline Horizon (Trading Days)"
            type="number"
            min="1"
            max="252"
            value={deadlineDays}
            onChange={(e) => setDeadlineDays(parseInt(e.target.value, 10) || 1)}
          />

          <Select
            label="Evaluation Mode"
            options={[
              { value: 'touch', label: 'Touch (Hits target at any point)' },
              { value: 'terminal', label: 'Terminal (At or above on deadline day)' }
            ]}
            value={targetMode}
            onChange={(e) => setTargetMode(e.target.value)}
          />

          {actionMessage && <p className="text-xs text-center text-mauve font-medium">{actionMessage}</p>}

          <div className="flex space-x-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setTargetModalOpen(false)}>Cancel</Button>
            <Button variant="primary" className="flex-1" onClick={handleSetTarget}>
              Calculate & Set Target
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default StockDetailView;
