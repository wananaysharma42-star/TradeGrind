import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  Activity,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge, NumberFlash, StockLogo } from '../../components/ui/StatTile.jsx';
import { FilterPills } from '../../components/ui/PillTabs.jsx';
import { PerformanceChart } from '../../components/ui/Charts.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { api } from '../../services/api.js';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../../utils/formatters.js';
import clsx from 'clsx';

export function CustomerDashboardView() {
  const stocks = useSelector((state) => state.market.stocks);
  const user = useSelector((state) => state.auth.user);
  const livePortfolio = useSelector((state) => state.portfolio.summary);
  const navigate = useNavigate();

  // State
  const [portfolioData, setPortfolioData] = useState(null);
  const [portfolioHistory, setPortfolioHistory] = useState([]);
  const [activeRange, setActiveRange] = useState('1M');
  const [watchlistFilter, setWatchlistFilter] = useState('all');
  const [watchlistItems, setWatchlistItems] = useState([]);
  const [homeInsights, setHomeInsights] = useState(null);
  const [trendingStocks, setTrendingStocks] = useState([]);

  // Detailed Analytics Strip state
  const [activeStripIndex, setActiveStripIndex] = useState(0);
  const [isStripPaused, setIsStripPaused] = useState(false);

  // Quant Insights drawer
  const [insightDrawerOpen, setInsightDrawerOpen] = useState(false);

  // Total Holding period pill
  const [holdingPeriod, setHoldingPeriod] = useState('1M');

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const [port, hist, wl, insights, trending] = await Promise.all([
          api.getPortfolio().catch(() => null),
          api.getPortfolioHistory('1M').catch(() => null),
          api.getWatchlist(watchlistFilter).catch(() => null),
          api.getHomeInsights().catch(() => null),
          api.getTrendingStocks().catch(() => null)
        ]);

        if (port) setPortfolioData(port);
        if (hist?.series) setPortfolioHistory(hist.series);
        if (wl) setWatchlistItems(wl);
        if (insights) setHomeInsights(insights);
        if (trending) {
          const trendList = Array.isArray(trending)
            ? trending
            : (trending.trending || trending.topMovers || []);
          setTrendingStocks(trendList);
        }
      } catch (err) {
        console.warn('Dashboard fetch error', err);
      }
    }
    loadData();
  }, []);

  // Reload watchlist on filter change
  useEffect(() => {
    async function updateWatchlist() {
      try {
        const res = await api.getWatchlist(watchlistFilter);
        if (res) setWatchlistItems(res);
      } catch (err) {
        // ignore
      }
    }
    updateWatchlist();
  }, [watchlistFilter]);

  // Handle Range change for PerformanceChart
  const handleRangeChange = async (r) => {
    setActiveRange(r);
    try {
      const res = await api.getPortfolioHistory(r);
      if (res?.series) setPortfolioHistory(res.series);
    } catch (err) {
      // ignore
    }
  };

  // Rotating Detailed Analytics strip timer (every 4 seconds)
  useEffect(() => {
    if (isStripPaused || !stocks.length) return;
    const interval = setInterval(() => {
      setActiveStripIndex((prev) => (prev + 1) % stocks.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isStripPaused, stocks.length]);

  // Effective live portfolio values from socket state or REST
  const currentTotalVal = livePortfolio?.totalPortfolioValue ?? livePortfolio?.totalValue ?? portfolioData?.totalPortfolioValue ?? portfolioData?.totalValue ?? user?.virtualBalance ?? 1000000;
  const currentCash = livePortfolio?.cashBalance ?? livePortfolio?.cash ?? portfolioData?.cashBalance ?? portfolioData?.cash ?? user?.virtualBalance ?? 1000000;
  const currentUnrealizedPnL = livePortfolio?.totalUnrealizedPnl ?? livePortfolio?.totalUnrealizedPnL ?? portfolioData?.totalUnrealizedPnl ?? portfolioData?.totalUnrealizedPnL ?? 0;
  const pnlPct = livePortfolio?.totalUnrealizedPnlPercent ?? portfolioData?.totalUnrealizedPnlPercent ?? (currentTotalVal > 0 ? (currentUnrealizedPnL / currentTotalVal) * 100 : 0);

  // Chart data formatting with live 1D append support
  const chartPoints = portfolioHistory.length > 0
    ? portfolioHistory.map((pt) => ({
        date: pt.date || `Day ${pt.simDay || 1}`,
        value: pt.portfolioValue || pt.totalValue || currentTotalVal
      }))
    : [
        { date: 'Initial', value: user?.virtualBalance ?? currentCash },
        { date: 'Current', value: currentTotalVal }
      ];

  const holdings = portfolioData?.holdings || [];
  const top4Holdings = holdings.slice(0, 4);

  // Rotating stock details
  const activeStripStock = stocks[activeStripIndex] || stocks[0] || null;

  const rotatingStockInsight = homeInsights?.detailedAnalytics?.find(
    (a) => a.symbol === activeStripStock?.symbol
  ) || homeInsights?.rotatingAnalyticsPanel?.find(
    (a) => a.symbol === activeStripStock?.symbol
  );

  const rotatingMetrics = rotatingStockInsight?.metrics || {
    estimatedAnnualizedVolatility: activeStripStock?.sigma || activeStripStock?.volatility || 0.20,
    return30d: (activeStripStock?.changePct || activeStripStock?.dayChangePercent || 0) / 100,
    sharpeRatio: 1.0,
    maxDrawdown: 0.05,
    rsi14: 50
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ========================================================= */}
      {/* 1. TOP ROW OF THREE CARDS (Matches Reference Screenshot) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Total Holding */}
        <GlassCard className="flex flex-col justify-between" glow>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Total Holding
              </span>
              <FilterPills
                options={['1D', '1W', '1M', '6M', '1Y']}
                value={holdingPeriod}
                onChange={setHoldingPeriod}
              />
            </div>

            <div className="my-3">
              <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                <NumberFlash
                  value={currentTotalVal}
                  formatter={(v) => formatINR(v)}
                />
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <span
                  className={clsx(
                    'inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full border',
                    pnlPct >= 0
                      ? 'bg-gain/15 text-gain border-gain/30'
                      : 'bg-loss/15 text-loss border-loss/30'
                  )}
                >
                  {pnlPct >= 0 ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                  {pnlPct >= 0 ? '+' : ''}{formatINR(Math.abs(currentUnrealizedPnL))} ({pnlPct.toFixed(2)}%)
                </span>
                <span className="text-[11px] text-muted">simulated P&L</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-muted">
            <span>Cash Balance:</span>
            <span className="font-semibold text-white font-mono">
              {formatINR(currentCash)}
            </span>
          </div>
        </GlassCard>

        {/* Card 2: Quant Insights Promo Card */}
        <GlassCard className="relative overflow-hidden flex flex-col justify-between border border-accent/30 bg-gradient-to-br from-white/[0.05] via-accent/10 to-transparent" glow>
          {/* Glowing Amber Arc */}
          <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-accent/20 blur-2xl" />
          <div className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full border border-accent/30 opacity-60" />
          <div className="pointer-events-none absolute -top-16 -right-16 w-52 h-52 rounded-full border border-accent/15 opacity-40" />

          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>INSIGHTS POWERED BY MATHS</span>
            </div>

            <h3 className="text-xl font-bold text-white tracking-tight leading-snug">
              Multi-Factor Quant Analytics
            </h3>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              Explore mathematical signal decoders, 95% Parametric VaR, Sortino downside ratios, and equal-weight market beta.
            </p>
          </div>

          <div className="mt-5 pt-3">
            <button
              onClick={() => setInsightDrawerOpen(true)}
              className="w-full inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-full bg-amber-gradient text-bg font-bold text-xs hover:brightness-110 transition-all shadow-glass-glow cursor-pointer"
            >
              <span>Explore Quant Insights</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </GlassCard>

        {/* Card 3: Watchlist with FilterPills */}
        <GlassCard className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Watchlist
              </span>
              <FilterPills
                options={[
                  { value: 'most_viewed', label: 'Most Viewed' },
                  { value: 'gain', label: 'Gain' },
                  { value: 'lose', label: 'Lose' }
                ]}
                value={watchlistFilter}
                onChange={setWatchlistFilter}
              />
            </div>

            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {watchlistItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted">
                  No stocks in this filter view.
                </div>
              ) : (
                watchlistItems.slice(0, 5).map((item) => {
                  const s = (typeof item.stockId === 'object' && item.stockId !== null) ? item.stockId : item;
                  const isUp = (s.changePct ?? s.dayChangePercent ?? 0) >= 0;
                  return (
                    <div
                      key={s.symbol}
                      onClick={() => navigate(`/customer/stock/${s._id || s.symbol}`)}
                      className="flex items-center justify-between p-2 rounded-16 hover:bg-white/[0.05] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        <StockLogo symbol={s.symbol} size="sm" />
                        <div>
                          <div className="text-xs font-bold text-white">{s.symbol}</div>
                          <div className="text-[10px] text-muted">{s.sector || 'Market'}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold text-white">
                          <NumberFlash
                            value={s.currentPrice || s.price || 100}
                            formatter={(v) => formatINR(v)}
                          />
                        </div>
                        <div
                          className={clsx(
                            'text-[10px] font-semibold',
                            isUp ? 'text-gain' : 'text-loss'
                          )}
                        >
                          {isUp ? '+' : ''}{Number(s.changePct ?? s.dayChangePercent ?? 0).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06] text-right">
            <button
              onClick={() => navigate('/customer/market')}
              className="text-xs text-accent hover:text-accent-deep font-medium"
            >
              Browse all stocks →
            </button>
          </div>
        </GlassCard>
      </div>

      {/* ========================================================= */}
      {/* 2. "MY PORTFOLIO" 2x2 TILE GRID */}
      {/* ========================================================= */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">My Portfolio</h3>
            <p className="text-xs text-muted">Top equity allocations with live valuation</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/customer/portfolio')}>
            See all
          </Button>
        </div>

        {top4Holdings.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">
            No stock holdings yet. Use the command bar or market page to execute your first order.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {top4Holdings.map((h) => {
              const isProfit = (h.unrealizedPnL ?? h.pnl ?? 0) >= 0;
              const hPnlPct = Number(h.unrealizedPnLPercent ?? h.pnlPercent ?? 0);
              return (
                <div
                  key={h.symbol}
                  onClick={() => navigate(`/customer/stock/${h.stockId || h.symbol}`)}
                  className="p-4 rounded-20 bg-white/[0.035] border border-white/[0.07] backdrop-blur-card hover:bg-white/[0.06] hover:border-accent/30 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2.5">
                      <StockLogo symbol={h.symbol} size="sm" />
                      <div>
                        <div className="text-xs font-bold text-white">{h.symbol}</div>
                        <div className="text-[10px] text-muted">{h.quantity} units</div>
                      </div>
                    </div>
                    <Badge variant={isProfit ? 'positive' : 'negative'} size="sm">
                      {isProfit ? '+' : ''}{hPnlPct.toFixed(2)}%
                    </Badge>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted">Valuation</div>
                    <div className="text-base font-bold text-white font-mono">
                      <NumberFlash
                        value={h.marketValue || h.currentValue || (h.quantity * (h.currentPrice || 0))}
                        formatter={(v) => formatINR(v)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* ========================================================= */}
      {/* 3. FULL-WIDTH "PORTFOLIO PERFORMANCE" CHART */}
      {/* ========================================================= */}
      <GlassCard>
        <PerformanceChart
          title="Portfolio Performance"
          range={activeRange}
          onRangeChange={handleRangeChange}
          data={chartPoints}
        />
      </GlassCard>

      {/* ========================================================= */}
      {/* 4. ROTATING "DETAILED ANALYTICS" STRIP */}
      {/* ========================================================= */}
      <GlassCard
        onMouseEnter={() => setIsStripPaused(true)}
        onMouseLeave={() => setIsStripPaused(false)}
        className="relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-bold text-white">Detailed Analytics:</h4>
                <span className="text-sm font-extrabold text-accent">{activeStripStock?.symbol || 'STOCK'}</span>
                <span className="text-xs text-muted">({activeStripStock?.name || 'Loading...'})</span>
              </div>
              <p className="text-[11px] text-muted">Slide through universe • Pauses on hover</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() =>
                setActiveStripIndex((prev) => (prev - 1 + stocks.length) % stocks.length)
              }
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-muted hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted font-mono">
              {activeStripIndex + 1} / {stocks.length || 1}
            </span>
            <button
              onClick={() => setActiveStripIndex((prev) => (prev + 1) % stocks.length)}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-muted hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 5 Column Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="p-3 rounded-16 bg-white/[0.03] border border-white/[0.06]">
            <div className="text-[11px] text-muted">Ann. Volatility</div>
            <div className="text-base font-bold text-white font-mono mt-0.5">
              {rotatingMetrics ? `${((rotatingMetrics.estimatedAnnualizedVolatility || 0) * 100).toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="p-3 rounded-16 bg-white/[0.03] border border-white/[0.06]">
            <div className="text-[11px] text-muted">30-Day Return</div>
            <div
              className={clsx(
                'text-base font-bold font-mono mt-0.5',
                (rotatingMetrics?.return30d || 0) >= 0 ? 'text-gain' : 'text-loss'
              )}
            >
              {rotatingMetrics ? `${(rotatingMetrics.return30d || 0) >= 0 ? '+' : ''}${((rotatingMetrics.return30d || 0) * 100).toFixed(2)}%` : '—'}
            </div>
          </div>
          <div className="p-3 rounded-16 bg-white/[0.03] border border-white/[0.06]">
            <div className="text-[11px] text-muted">Sharpe Ratio</div>
            <div className="text-base font-bold text-white font-mono mt-0.5">
              {rotatingMetrics?.sharpeRatio != null ? Number(rotatingMetrics.sharpeRatio).toFixed(2) : '—'}
            </div>
          </div>
          <div className="p-3 rounded-16 bg-white/[0.03] border border-white/[0.06]">
            <div className="text-[11px] text-muted">Max Drawdown</div>
            <div className="text-base font-bold text-white font-mono mt-0.5">
              {rotatingMetrics?.maxDrawdown != null ? `${((rotatingMetrics.maxDrawdown || 0) * 100).toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="p-3 rounded-16 bg-white/[0.03] border border-white/[0.06] col-span-2 sm:col-span-1">
            <div className="text-[11px] text-muted">RSI (14)</div>
            <div className="text-base font-bold text-accent font-mono mt-0.5">
              {rotatingMetrics?.rsi14 != null ? Number(rotatingMetrics.rsi14).toFixed(1) : '—'}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ========================================================= */}
      {/* 5. TRENDING STOCKS SLIDING CAROUSEL */}
      {/* ========================================================= */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-gain" />
            <h4 className="text-sm font-bold text-white tracking-wide">Trending Stocks</h4>
          </div>
          <span className="text-[11px] text-muted">Ranked by 1-day change, volume & vol</span>
        </div>

        <div className="flex space-x-4 overflow-x-auto pb-2 scrollbar-none">
          {(trendingStocks.length > 0 ? trendingStocks : stocks.slice(0, 8)).map((s) => {
            const isUp = (s.dayChangePercent ?? s.changePct ?? 0) >= 0;
            return (
              <div
                key={s.symbol}
                onClick={() => navigate(`/customer/stock/${s._id || s.symbol}`)}
                className="shrink-0 w-44 p-3.5 rounded-20 bg-white/[0.03] border border-white/[0.07] hover:border-accent/40 hover:bg-white/[0.05] transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <StockLogo symbol={s.symbol} size="sm" />
                  <span
                    className={clsx(
                      'text-xs font-bold',
                      isUp ? 'text-gain' : 'text-loss'
                    )}
                  >
                    {isUp ? '+' : ''}{Number(s.dayChangePercent ?? s.changePct ?? 0).toFixed(2)}%
                  </span>
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{s.symbol}</div>
                  <div className="text-sm font-semibold text-white font-mono mt-0.5">
                    {formatINR(s.currentPrice ?? s.price ?? 100)}
                  </div>
                </div>
                {s.reason && (
                  <div className="mt-2 pt-1 border-t border-white/[0.05] text-[10px] text-muted truncate">
                    {s.reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* ========================================================= */}
      {/* QUANT INSIGHTS MODAL / DRAWER */}
      {/* ========================================================= */}
      <Modal
        isOpen={insightDrawerOpen}
        onClose={() => setInsightDrawerOpen(false)}
        title="Quant Insights Hub"
        subtitle="Numbers & mathematical signals computed from the simulation engine"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="p-4 rounded-20 bg-accent/15 border border-accent/30">
            <h5 className="text-xs font-bold text-accent uppercase tracking-wider mb-1">
              Market Equal-Weight Model
            </h5>
            <p className="text-xs text-white leading-relaxed">
              Drift is estimated at {((homeInsights?.marketOverview?.averageDrift || 0.12) * 100).toFixed(1)}% with cross-sectional volatility of {((homeInsights?.marketOverview?.averageVolatility || 0.22) * 100).toFixed(1)}%.
            </p>
          </div>

          <div className="space-y-3">
            <h5 className="text-xs font-bold text-muted uppercase tracking-wider">Top Quantitative Signals</h5>
            {homeInsights?.signals?.length > 0 ? (
              homeInsights.signals.map((sig, idx) => (
                <div key={idx} className="p-3.5 rounded-16 bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">{sig.symbol}</div>
                    <div className="text-[11px] text-muted mt-0.5">{sig.message || sig.description}</div>
                  </div>
                  <Badge variant="accent" size="sm">
                    {sig.type || 'SIGNAL'}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-xs text-muted text-center py-4">
                No active mathematical outliers detected on this tick cycle.
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default CustomerDashboardView;
