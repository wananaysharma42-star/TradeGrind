import React, { useEffect, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  TrendingUp,
  Award,
  ShieldAlert,
  Percent,
  Activity,
  Layers,
  ArrowUpRight,
  Info,
  ChevronRight,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard.jsx';
import { StatTile, NumberFlash, StockLogo, Badge } from '../../components/ui/StatTile.jsx';
import { PerformanceChart } from '../../components/ui/Charts.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { api } from '../../services/api.js';
import { useSocket } from '../../hooks/useSocket.js';
import { formatINR } from '../../utils/formatters.js';
import clsx from 'clsx';

export function CompanyDashboardView() {
  const [homeData, setHomeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('1M');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Subscribe to socket updates
  const { socket } = useSocket();

  const fetchHome = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    try {
      const res = await api.getCompanyHome();
      if (res) {
        setHomeData(res);
      }
    } catch (err) {
      console.warn('Failed to load company home data:', err);
    } finally {
      setLoading(false);
      if (showRefresh) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHome();
  }, []);

  // Listen to live company updates from socket
  useEffect(() => {
    if (!socket) return;

    const handleCompanyUpdate = (update) => {
      setHomeData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          stock: {
            ...prev.stock,
            currentPrice: update.price ?? prev.stock.currentPrice
          },
          livePriceSeries: update.recentPrices ?? prev.livePriceSeries,
          riskMetrics: {
            ...prev.riskMetrics,
            ...(update.riskMetrics || {})
          }
        };
      });
    };

    socket.on('company:update', handleCompanyUpdate);
    socket.on('stock:update', (stockUpdate) => {
      setHomeData((prev) => {
        if (!prev || !prev.stock) return prev;
        if (stockUpdate.stockId === prev.stock.id || stockUpdate.symbol === prev.stock.symbol) {
          return {
            ...prev,
            stock: {
              ...prev.stock,
              currentPrice: stockUpdate.price ?? stockUpdate.currentPrice ?? prev.stock.currentPrice
            }
          };
        }
        return prev;
      });
    });

    return () => {
      socket.off('company:update', handleCompanyUpdate);
    };
  }, [socket]);

  const stock = homeData?.stock;
  const ranks = homeData?.ranks;
  const risk = homeData?.riskMetrics;
  const last10 = homeData?.last10Days || [];

  // Performance Chart Data format
  const chartData = useMemo(() => {
    if (!homeData?.livePriceSeries || homeData.livePriceSeries.length === 0) {
      return [{ timestamp: 'Current', value: stock?.currentPrice || 100 }];
    }
    return homeData.livePriceSeries.map((p, idx) => ({
      timestamp: `T-${homeData.livePriceSeries.length - idx}`,
      value: p
    }));
  }, [homeData, stock]);

  const currentPrice = stock?.currentPrice || 0;
  const prevClose = stock?.previousClose || currentPrice;
  const dayChangePct = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0;

  // Last 10 Days table columns with inline mini bars
  const historyColumns = [
    {
      header: 'Sim Day',
      accessor: 'simDay',
      render: (d) => <span className="font-mono text-plum-light font-medium">Day {d}</span>
    },
    {
      header: 'Open',
      accessor: 'open',
      render: (v) => formatINR(v)
    },
    {
      header: 'High / Low',
      accessor: 'high',
      render: (_, row) => (
        <span className="text-xs text-plum-light/70 font-mono">
          {formatINR(row.high)} / {formatINR(row.low)}
        </span>
      )
    },
    {
      header: 'Close',
      accessor: 'close',
      render: (v) => <span className="font-semibold text-plum-white">{formatINR(v)}</span>
    },
    {
      header: 'Return',
      accessor: 'returnPercent',
      render: (r) => {
        const val = Number(r);
        return (
          <div className="flex items-center gap-2">
            <span className={clsx('font-semibold text-xs', val >= 0 ? 'text-trade-green' : 'text-trade-red')}>
              {val >= 0 ? '+' : ''}{val.toFixed(2)}%
            </span>
            {/* Inline Mini Bar */}
            <div className="w-12 h-1.5 rounded-full bg-white/5 overflow-hidden flex items-center">
              <div
                className={clsx('h-full rounded-full', val >= 0 ? 'bg-trade-green' : 'bg-trade-red')}
                style={{ width: `${Math.min(100, Math.abs(val) * 10)}%` }}
              />
            </div>
          </div>
        );
      }
    },
    {
      header: 'Volume',
      accessor: 'volume',
      render: (v) => (
        <div className="flex items-center gap-2">
          <span className="text-xs text-plum-light/90 font-mono">{Number(v).toLocaleString()}</span>
          {/* Volume mini bar */}
          <div className="w-10 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-plum-glow/60 rounded-full"
              style={{ width: `${Math.min(100, (Number(v) / 10000) * 100)}%` }}
            />
          </div>
        </div>
      )
    },
    {
      header: 'Volatility',
      accessor: 'volatilityPercent',
      render: (v) => <span className="text-xs font-mono text-plum-light/80">{Number(v).toFixed(2)}%</span>
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-44 rounded-3xl bg-glass-surface border border-glass-border" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-glass-surface border border-glass-border" />
          ))}
        </div>
        <div className="h-80 rounded-3xl bg-glass-surface border border-glass-border" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Live Stock Overview */}
      <GlassCard className="p-6 relative overflow-hidden" glow>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <StockLogo symbol={stock?.symbol || 'CMP'} size="lg" />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-plum-white tracking-tight">{stock?.name || 'Company Stock'}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-plum-light">
                  {stock?.symbol}
                </span>
                <span className="px-2 py-0.5 rounded-md text-xs bg-plum-glow/20 text-plum-glow font-medium">
                  {stock?.sector || 'Equities'}
                </span>
              </div>
              <p className="text-xs text-plum-light/70 mt-1">
                Real-time stock dashboard & risk telemetry streamed from live market engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs text-plum-light/60 block">Live Price</span>
              <div className="text-3xl font-extrabold text-plum-white tracking-tight">
                <NumberFlash value={currentPrice} format={(v) => formatINR(v)} />
              </div>
              <div className="mt-0.5">
                <Badge value={dayChangePct} isPercent />
              </div>
            </div>

            <Button
              variant="icon-round"
              onClick={() => fetchHome(true)}
              className={clsx('border border-glass-border', isRefreshing && 'animate-spin')}
              title="Refresh telemetry"
            >
              <RefreshCw className="w-4 h-4 text-plum-light" />
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Rank Cards & Score Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sector Rank Card */}
        <GlassCard className="p-5 flex items-center justify-between group hover:border-plum-glow/40 transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-trade-green/10 border border-trade-green/20 flex items-center justify-center text-trade-green">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-plum-light/60 uppercase tracking-wider font-semibold">Sector Standing</span>
              <div className="text-2xl font-extrabold text-plum-white mt-0.5">
                #{ranks?.sectorRank || 1} <span className="text-xs text-plum-light/60 font-normal">in {stock?.sector || 'Sector'}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-plum-light/50">Overall Universe</span>
            <div className="text-sm font-semibold text-plum-light">
              #{ranks?.overallRank || 1} <span className="text-xs text-plum-light/40">of {ranks?.totalCompanies || 10}</span>
            </div>
          </div>
        </GlassCard>

        {/* Quant Performance Score Card with Breakdown Tooltip */}
        <GlassCard className="p-5 flex items-center justify-between group hover:border-plum-glow/40 transition-all relative">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-plum-glow/10 border border-plum-glow/20 flex items-center justify-center text-plum-glow">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-plum-light/60 uppercase tracking-wider font-semibold">Quant Score</span>
                {/* Tooltip trigger */}
                <div className="group/tt relative cursor-pointer">
                  <Info className="w-3.5 h-3.5 text-plum-light/50 hover:text-plum-white" />
                  <div className="absolute right-0 bottom-6 hidden group-hover/tt:block w-64 p-3 bg-plum-card/95 border border-glass-border rounded-xl shadow-2xl backdrop-blur-md z-30 text-xs">
                    <p className="font-semibold text-plum-white mb-2">Quant Score Breakdown</p>
                    <div className="space-y-1.5 text-plum-light/80">
                      <div className="flex justify-between">
                        <span>Returns Momentum:</span>
                        <span className="font-mono text-plum-white">
                          {Math.round((ranks?.components?.momentum || 50) * 10) / 10}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Risk Adjusted Sharpe:</span>
                        <span className="font-mono text-plum-white">
                          {Math.round((ranks?.components?.sharpe || 50) * 10) / 10}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Drawdown Resilience:</span>
                        <span className="font-mono text-plum-white">
                          {Math.round((ranks?.components?.drawdown || 50) * 10) / 10}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Low Volatility Bonus:</span>
                        <span className="font-mono text-plum-white">
                          {Math.round((ranks?.components?.volatility || 50) * 10) / 10}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-2xl font-extrabold text-plum-white mt-0.5">
                {ranks?.score || 72} <span className="text-xs text-plum-light/60 font-normal">/ 100</span>
              </div>
            </div>
          </div>
          <div className="h-2 w-28 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-plum-glow to-trade-green rounded-full"
              style={{ width: `${Math.min(100, ranks?.score || 70)}%` }}
            />
          </div>
        </GlassCard>
      </div>

      {/* Key Risk Telemetry Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <span className="text-xs text-plum-light/60 font-medium">Annualised Volatility (σ)</span>
          <div className="text-xl font-bold text-plum-white mt-1">
            {((risk?.estimatedVolatility || 0.22) * 100).toFixed(2)}%
          </div>
          <span className="text-[11px] text-plum-light/50 mt-1 block">EWMA 50/50 blend</span>
        </GlassCard>

        <GlassCard className="p-4">
          <span className="text-xs text-plum-light/60 font-medium">Sharpe Ratio</span>
          <div className="text-xl font-bold text-plum-white mt-1">
            {Number(risk?.sharpeRatio || 1.15).toFixed(2)}
          </div>
          <span className="text-[11px] text-trade-green mt-1 block font-medium">Rf = 6.0% p.a.</span>
        </GlassCard>

        <GlassCard className="p-4">
          <span className="text-xs text-plum-light/60 font-medium">Max Drawdown</span>
          <div className="text-xl font-bold text-trade-red mt-1">
            -{(Math.abs(risk?.maxDrawdown || 0.08) * 100).toFixed(2)}%
          </div>
          <span className="text-[11px] text-plum-light/50 mt-1 block">Peak to trough peak</span>
        </GlassCard>

        <GlassCard className="p-4">
          <span className="text-xs text-plum-light/60 font-medium">1-Day VaR (95%)</span>
          <div className="text-xl font-bold text-plum-white mt-1">
            ${Number(risk?.valueAtRisk95_1Day || 2.45).toFixed(2)}
          </div>
          <span className="text-[11px] text-plum-light/50 mt-1 block">
            CVaR: ${Number(risk?.expectedShortfall95_1Day || 3.12).toFixed(2)}
          </span>
        </GlassCard>
      </div>

      {/* Live Own Stock Performance Chart */}
      <GlassCard className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-plum-white">Live Equity Curve</h2>
            <p className="text-xs text-plum-light/60 mt-0.5">
              Intraday streaming ticks & daily closing historical trajectory
            </p>
          </div>
          {/* Period Range Tabs */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-glass-border">
            {['1D', '1W', '1M', '6M', '1Y'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={clsx(
                  'px-3 py-1 rounded-lg text-xs font-semibold transition-all',
                  period === p ? 'bg-plum-glow/30 text-plum-white' : 'text-plum-light/60 hover:text-plum-light'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <PerformanceChart
          data={chartData}
          selectedRange={period}
          onRangeChange={setPeriod}
          liveAppend={period === '1D'}
          height={320}
        />
      </GlassCard>

      {/* Last 10 Days Insights Table */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-plum-white">Last 10 Days Insights</h2>
            <p className="text-xs text-plum-light/60 mt-0.5">
              Simulated candle telemetry, returns distribution and daily trading volume
            </p>
          </div>
          <span className="text-xs text-plum-light/60 font-mono">10 Sessions Logged</span>
        </div>

        <DataTable
          columns={historyColumns}
          data={last10}
          emptyMessage="No historical candles recorded yet."
        />
      </GlassCard>
    </div>
  );
}
