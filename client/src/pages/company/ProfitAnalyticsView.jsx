import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp,
  Percent,
  Sliders,
  Maximize2,
  Calendar,
  Layers,
  ArrowDownRight,
  Shield,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge, StatTile } from '../../components/ui/StatTile.jsx';
import { RebasedComparisonChart, FanChart, LiveLineChart } from '../../components/ui/Charts.jsx';
import { PillTabs } from '../../components/ui/PillTabs.jsx';
import { api } from '../../services/api.js';
import clsx from 'clsx';

export function ProfitAnalyticsView() {
  const [data, setData] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [selectedPeers, setSelectedPeers] = useState([]);
  const [activeTab, setActiveTab] = useState('outlook');
  const [loading, setLoading] = useState(true);

  // Fetch stocks universe for comparison selector
  useEffect(() => {
    async function loadUniverse() {
      try {
        const list = await api.getStocks();
        if (list) setStocks(list);
      } catch (err) {
        console.warn('Failed to load universe:', err);
      }
    }
    loadUniverse();
  }, []);

  // Fetch profit analytics with compare symbols
  const loadAnalytics = async () => {
    try {
      const res = await api.getCompanyProfitAnalytics(selectedPeers.join(','));
      if (res) setData(res);
    } catch (err) {
      console.warn('Failed to load profit analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [selectedPeers]);

  const togglePeer = (symbol) => {
    setSelectedPeers((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
  };

  const rebasedSeries = data?.rebasedPriceSeries || [];
  const fanChart = data?.fanChart30Days;
  const life = data?.lifeSinceListing;

  const sideTabs = [
    { id: 'outlook', label: 'Outlook (30D)' },
    { id: 'life', label: 'Life Since Listing' },
    { id: 'drawdown', label: 'Drawdown Series' },
    { id: 'volatility', label: 'Rolling Volatility' }
  ];

  // Drawdown chart series formatting
  const drawdownChartData = useMemo(() => {
    if (!life?.drawdownSeries) return [];
    return life.drawdownSeries.map((dd, idx) => ({
      tick: `D${idx + 1}`,
      price: dd
    }));
  }, [life]);

  // Rolling volatility chart series formatting
  const volChartData = useMemo(() => {
    if (!life?.rollingVolatilitySeries) return [];
    return life.rollingVolatilitySeries.map((v, idx) => ({
      tick: `D${idx + 1}`,
      price: v * 100
    }));
  }, [life]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-3xl bg-glass-surface border border-glass-border" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 rounded-3xl bg-glass-surface border border-glass-border" />
          <div className="h-96 rounded-3xl bg-glass-surface border border-glass-border" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <GlassCard className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-plum-white tracking-tight">Profit & Peer Analytics</h1>
            <p className="text-xs text-plum-light/70 mt-1">
              Normalized comparative performance against industry peers & Monte Carlo projection models
            </p>
          </div>

          {/* Peer Overlay Multi-Select */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-plum-light/60 font-semibold mr-1">Overlay Peers:</span>
            {stocks.slice(0, 5).map((s) => {
              const active = selectedPeers.includes(s.symbol);
              return (
                <button
                  key={s.symbol}
                  onClick={() => togglePeer(s.symbol)}
                  className={clsx(
                    'px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all',
                    active
                      ? 'bg-plum-glow/30 border-plum-glow text-plum-white shadow-plum-sm'
                      : 'bg-white/5 border-glass-border text-plum-light/70 hover:text-plum-light hover:border-white/20'
                  )}
                >
                  {s.symbol}
                </button>
              );
            })}
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart: Rebased to 100 Comparison */}
        <div className="lg:col-span-2 space-y-6">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-plum-white">Rebased Performance (Base = 100)</h2>
                <p className="text-xs text-plum-light/60 mt-0.5">
                  Direct price return normalization starting from day 1 with brush range slider
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-plum-glow" />
                <span className="text-xs text-plum-light/80 font-medium">Own Stock</span>
              </div>
            </div>

            <RebasedComparisonChart series={rebasedSeries} height={340} />
          </GlassCard>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <GlassCard className="p-4">
              <span className="text-xs text-plum-light/60">Cumulative Return</span>
              <div
                className={clsx(
                  'text-xl font-bold mt-1',
                  (life?.cumulativeReturnPercent || 0) >= 0 ? 'text-trade-green' : 'text-trade-red'
                )}
              >
                {(life?.cumulativeReturnPercent || 0) >= 0 ? '+' : ''}
                {life?.cumulativeReturnPercent || 0}%
              </div>
              <span className="text-[11px] text-plum-light/50 mt-1 block">Since listing launch</span>
            </GlassCard>

            <GlassCard className="p-4">
              <span className="text-xs text-plum-light/60">Sessions Recorded</span>
              <div className="text-xl font-bold text-plum-white mt-1">
                {life?.totalDays || 30} Days
              </div>
              <span className="text-[11px] text-plum-light/50 mt-1 block">Total candle history</span>
            </GlassCard>

            <GlassCard className="p-4">
              <span className="text-xs text-plum-light/60">30D Gain Probability</span>
              <div className="text-xl font-bold text-plum-glow mt-1">
                {Math.round((fanChart?.probabilityHigher || 0.65) * 100)}%
              </div>
              <span className="text-[11px] text-plum-light/50 mt-1 block">2,000 MC simulation paths</span>
            </GlassCard>
          </div>
        </div>

        {/* Side Panel Tabs: Outlook / Life / Drawdown / Volatility */}
        <div className="space-y-4">
          <GlassCard className="p-6">
            <div className="mb-4">
              <PillTabs
                tabs={sideTabs}
                activeTab={activeTab}
                onChange={setActiveTab}
                className="w-full text-xs"
              />
            </div>

            {/* TAB 1: Outlook (30-day fan chart + probability) */}
            {activeTab === 'outlook' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-glass-border">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-plum-light/70">Probability of Gain</span>
                    <span className="text-base font-bold text-trade-green">
                      {Math.round((fanChart?.probabilityHigher || 0.65) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-trade-green rounded-full"
                      style={{ width: `${(fanChart?.probabilityHigher || 0.65) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-plum-light/50 mt-1.5 block">
                    Monte Carlo paths where terminal price &gt; S₀ over next 30 days
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-plum-light/70 font-semibold">30-Day Fan Chart Projections</span>
                  <FanChart percentiles={fanChart?.percentiles} height={220} />
                </div>
              </div>
            )}

            {/* TAB 2: Life Since Listing */}
            {activeTab === 'life' && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-white/5 border border-glass-border flex justify-between items-center">
                    <span className="text-xs text-plum-light/70">Total Trading Days</span>
                    <span className="font-mono text-sm font-semibold text-plum-white">
                      {life?.totalDays || 0}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/5 border border-glass-border flex justify-between items-center">
                    <span className="text-xs text-plum-light/70">Cumulative Return</span>
                    <span
                      className={clsx(
                        'font-mono text-sm font-semibold',
                        (life?.cumulativeReturnPercent || 0) >= 0 ? 'text-trade-green' : 'text-trade-red'
                      )}
                    >
                      {(life?.cumulativeReturnPercent || 0) >= 0 ? '+' : ''}
                      {life?.cumulativeReturnPercent || 0}%
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/5 border border-glass-border flex justify-between items-center">
                    <span className="text-xs text-plum-light/70">Current Simulation Phase</span>
                    <span className="text-xs text-trade-green font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-trade-green animate-pulse" />
                      Active Quoting
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Drawdown Series */}
            {activeTab === 'drawdown' && (
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-plum-light/70 font-semibold block mb-1">
                    Historical Peak-to-Trough Drawdown (%)
                  </span>
                  <p className="text-[11px] text-plum-light/50 mb-3">
                    Percentage drawdown from all-time highs across recorded sessions
                  </p>
                  <LiveLineChart data={drawdownChartData} height={220} />
                </div>
              </div>
            )}

            {/* TAB 4: Rolling Volatility */}
            {activeTab === 'volatility' && (
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-plum-light/70 font-semibold block mb-1">
                    20-Day Rolling Volatility (σ Annualized %)
                  </span>
                  <p className="text-[11px] text-plum-light/50 mb-3">
                    Rolling standard deviation of logarithmic returns annualized
                  </p>
                  <LiveLineChart data={volChartData} height={220} />
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
