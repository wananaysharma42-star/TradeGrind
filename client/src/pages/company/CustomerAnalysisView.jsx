import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Filter,
  DollarSign,
  TrendingUp,
  Activity,
  ArrowUpDown,
  Clock,
  PieChart as PieIcon,
  BarChart3
} from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Histogram, LiveLineChart } from '../../components/ui/Charts.jsx';
import { api } from '../../services/api.js';
import { formatINR } from '../../utils/formatters.js';
import clsx from 'clsx';

export function CustomerAnalysisView() {
  const [category, setCategory] = useState('all');
  const [customersData, setCustomersData] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [loading, setLoading] = useState(true);

  const categories = [
    { id: 'all', label: 'All Holders' },
    { id: 'new', label: 'New (< 3D)' },
    { id: 'long-term', label: 'Long-Term (>= 10D)' },
    { id: 'profit', label: 'In Profit' },
    { id: 'loss', label: 'In Loss' },
    { id: 'high-volume', label: 'High Volume' }
  ];

  // Fetch holders by category
  const loadHolders = async () => {
    try {
      const res = await api.getCompanyCustomers(category);
      if (res) setCustomersData(res);
    } catch (err) {
      console.warn('Failed to load customers:', err);
    }
  };

  // Fetch customer activity trends
  const loadTrend = async () => {
    try {
      const res = await api.getCompanyCustomerTrend();
      if (res) setTrendData(res);
    } catch (err) {
      console.warn('Failed to load customer trends:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHolders();
  }, [category]);

  useEffect(() => {
    loadTrend();
  }, []);

  const holders = customersData?.holders || [];
  const rules = customersData?.categoryRules || {};
  const currentRuleDesc = rules[category] || 'Shareholders holding your stock';

  // Format buy/sell daily activity chart
  const activityChartData = useMemo(() => {
    if (!trendData?.dailyActivity) return [];
    return trendData.dailyActivity.map((a) => ({
      tick: `Day ${a.simDay}`,
      price: a.buyVolume - a.sellVolume // Net volume flow
    }));
  }, [trendData]);

  const priceComp = trendData?.priceComparison;
  const histBins = trendData?.profitRateHistogram || [];

  // Holders DataTable Columns
  const columns = [
    {
      header: 'Investor',
      accessor: 'name',
      render: (name, row) => (
        <div>
          <span className="font-semibold text-white text-xs">{name}</span>
          <span className="text-[10px] text-muted block">{row.email}</span>
        </div>
      )
    },
    {
      header: 'Quantity',
      accessor: 'quantity',
      render: (q) => <span className="font-mono text-xs font-semibold text-white">{Number(q).toLocaleString()} shares</span>
    },
    {
      header: 'Avg Buy Price',
      accessor: 'avgBuyPrice',
      render: (v) => <span className="font-mono text-xs text-muted">{formatINR(v)}</span>
    },
    {
      header: 'Current Value',
      accessor: 'marketValue',
      render: (v) => <span className="font-mono text-xs text-white font-semibold">{formatINR(v)}</span>
    },
    {
      header: 'Unrealized P&L',
      accessor: 'unrealizedPnL',
      render: (pnl, row) => {
        const val = Number(pnl);
        const pct = Number(row.unrealizedPnLPercent);
        return (
          <div className="font-mono text-xs font-semibold">
            <span className={val >= 0 ? 'text-gain' : 'text-loss'}>
              {val >= 0 ? '+' : ''}{formatINR(Math.abs(val))}
            </span>
            <span className={clsx('ml-1 text-[10px]', pct >= 0 ? 'text-gain' : 'text-loss')}>
              ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
            </span>
          </div>
        );
      }
    },
    {
      header: 'Holding Period',
      accessor: 'holdingPeriodDays',
      render: (d) => (
        <span className="text-xs text-muted font-mono flex items-center gap-1">
          <Clock className="w-3 h-3 text-muted/60" />
          {d} days
        </span>
      )
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 rounded-3xl bg-glass-surface border border-glass-border" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 rounded-3xl bg-glass-surface border border-glass-border" />
          <div className="h-96 rounded-3xl bg-glass-surface border border-glass-border" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Category Filter Chips */}
      <GlassCard className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Customer & Shareholder Analysis</h1>
            <p className="text-xs text-muted mt-1">
              Active shareholder demographics, holding periods, profit distributions, and daily transaction flows
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted font-semibold mr-1">Category:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={clsx(
                    'px-3 py-1 rounded-xl text-xs font-semibold border transition-all',
                    category === c.id
                      ? 'bg-accent/20 border-accent/40 text-accent font-semibold shadow-sm'
                      : 'bg-white/5 border-glass-border text-muted hover:text-white hover:border-white/20'
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category Description Rule Pill */}
        <div className="mt-4 p-2.5 rounded-xl bg-white/5 border border-glass-border flex items-center justify-between text-xs">
          <span className="text-muted">
            <span className="text-accent font-semibold uppercase tracking-wider text-[10px] mr-2">Rule Filter:</span>
            {currentRuleDesc}
          </span>
          <span className="font-mono text-white font-semibold">{holders.length} match{holders.length === 1 ? '' : 'es'}</span>
        </div>
      </GlassCard>

      {/* Main Grid: Holders Table & Trend Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Holders Glass Table */}
        <div className="lg:col-span-2">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Shareholders Directory</h2>
                <p className="text-xs text-muted mt-0.5">
                  Live unrealized P&L, share counts, and simulated tenure
                </p>
              </div>
            </div>

            <DataTable
              columns={columns}
              data={holders}
              emptyMessage="No shareholders found matching this category filter."
            />
          </GlassCard>
        </div>

        {/* Right: Trend & Distribution Panel */}
        <div className="space-y-6">
          {/* Price Comparison Card */}
          <GlassCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-3">Price vs Average Holder Basis</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/5 border border-glass-border">
                <span className="text-[11px] text-muted block">Live Price</span>
                <span className="text-lg font-bold text-white font-mono">
                  {formatINR(priceComp?.currentPrice || 0)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-glass-border">
                <span className="text-[11px] text-muted block">Avg Holder Basis</span>
                <span className="text-lg font-bold text-accent font-mono">
                  {formatINR(priceComp?.averageBuyPrice || 0)}
                </span>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted flex justify-between items-center">
              <span>Overall Investor Sentiment:</span>
              <span className={clsx('font-semibold', (priceComp?.currentPrice || 0) >= (priceComp?.averageBuyPrice || 0) ? 'text-gain' : 'text-loss')}>
                {(priceComp?.currentPrice || 0) >= (priceComp?.averageBuyPrice || 0) ? 'Net Profit' : 'Under Pressure'}
              </span>
            </div>
          </GlassCard>

          {/* Shareholder Profit Rate Histogram */}
          <GlassCard className="p-5">
            <div className="mb-2">
              <h3 className="text-sm font-bold text-white">Profit Rate Distribution</h3>
              <p className="text-[11px] text-muted">
                Number of holders categorized by unrealized profit %
              </p>
            </div>
            <Histogram bins={histBins} height={180} />
          </GlassCard>

          {/* Net Flow Trend (Daily Net Volume Chart) */}
          <GlassCard className="p-5">
            <div className="mb-2">
              <h3 className="text-sm font-bold text-white">Net Volume Flow (Buys - Sells)</h3>
              <p className="text-[11px] text-muted">
                Daily accumulated retail share flow across simulated sessions
              </p>
            </div>
            <LiveLineChart data={activityChartData} height={160} />
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
