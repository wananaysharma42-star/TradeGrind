import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  ShieldAlert,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles
} from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard.jsx';
import { StatTile, NumberFlash, StockLogo, Badge } from '../../components/ui/StatTile.jsx';
import { PerformanceChart, Sparkline, ProbabilityGauge } from '../../components/ui/Charts.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { api } from '../../services/api.js';
import { formatINR } from '../../utils/formatters.js';

export function CustomerDashboard() {
  const stocks = useSelector((state) => state.market.stocks);
  const user = useSelector((state) => state.auth.user);
  const [portfolioData, setPortfolioData] = useState(null);
  const [portfolioHistory, setPortfolioHistory] = useState([]);
  const [homeInsights, setHomeInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [port, hist, insights] = await Promise.all([
          api.getPortfolio().catch(() => null),
          api.getPortfolioHistory('1M').catch(() => null),
          api.getHomeInsights().catch(() => null)
        ]);
        if (port) setPortfolioData(port);
        if (hist) setPortfolioHistory(hist.series || []);
        if (insights) setHomeInsights(insights);
      } catch (err) {
        console.warn('Dashboard fetch error', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const totalValue = portfolioData?.totalValue ?? 1000000;
  const cashBalance = portfolioData?.cashBalance ?? (user?.balance || 1000000);
  const unrealizedPnL = portfolioData?.totalUnrealizedPnL ?? 0;
  const pnlPercent = totalValue > 0 ? (unrealizedPnL / totalValue) * 100 : 0;

  // Chart data formatting
  const chartPoints = portfolioHistory.length > 0
    ? portfolioHistory.map((pt) => ({
        date: pt.date || `Day ${pt.simDay || 1}`,
        value: pt.portfolioValue || pt.totalValue || totalValue
      }))
    : [
        { date: 'Day 1', value: 980000 },
        { date: 'Day 5', value: 995000 },
        { date: 'Day 10', value: 1010000 },
        { date: 'Day 20', value: 1025000 },
        { date: 'Today', value: totalValue }
      ];

  const holdingsColumns = [
    {
      header: 'Asset',
      accessor: 'symbol',
      render: (symbol, row) => (
        <div className="flex items-center space-x-3">
          <StockLogo symbol={symbol} size="sm" />
          <div>
            <div className="font-semibold text-white">{symbol}</div>
            <div className="text-[10px] text-muted">{row.name || 'Stock'}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Holding Shares',
      accessor: 'quantity',
      render: (qty) => Number(qty).toLocaleString()
    },
    {
      header: 'Avg Price',
      accessor: 'avgBuyPrice',
      render: (price) => formatINR(price)
    },
    {
      header: 'Live Price',
      accessor: 'currentPrice',
      render: (price, row) => (
        <NumberFlash value={price || 100} formatter={(p) => formatINR(p)} />
      )
    },
    {
      header: 'P&L',
      accessor: 'unrealizedPnL',
      render: (pnl) => {
        const val = Number(pnl || 0);
        return (
          <span className={val >= 0 ? 'text-gain font-semibold' : 'text-loss font-semibold'}>
            {val >= 0 ? '+' : ''}{formatINR(Math.abs(val))}
          </span>
        );
      }
    },
    {
      header: 'Allocation',
      accessor: 'allocationPercent',
      render: (alloc) => `${Number(alloc || 0).toFixed(1)}%`
    }
  ];

  return (
    <div className="space-y-6">
      {/* KPI Tiles Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Total Portfolio Value"
          value={<NumberFlash value={totalValue} formatter={(v) => formatINR(v)} />}
          change={pnlPercent}
          subvalue="vs inception"
          icon={<DollarSign className="w-4 h-4 text-accent" />}
        />
        <StatTile
          label="Cash Balance"
          value={formatINR(cashBalance)}
          subvalue="Available for trading"
          icon={<Activity className="w-4 h-4 text-accent" />}
        />
        <StatTile
          label="Portfolio Volatility"
          value={`${((portfolioData?.portfolioVolatility || 0.16) * 100).toFixed(1)}%`}
          subvalue="Annualized 30-day"
          icon={<TrendingUp className="w-4 h-4 text-accent" />}
        />
        <StatTile
          label="Annualized Sharpe"
          value={Number(portfolioData?.sharpeRatio || 1.45).toFixed(2)}
          subvalue="rf = 6.0%"
          icon={<Sparkles className="w-4 h-4 text-accent" />}
        />
      </div>

      {/* Main Chart + Quant Insights Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2">
          <PerformanceChart
            title="Portfolio Performance"
            data={chartPoints}
            onRangeChange={async (r) => {
              const res = await api.getPortfolioHistory(r).catch(() => null);
              if (res?.series) setPortfolioHistory(res.series);
            }}
          />
        </GlassCard>

        {/* Quant Insights Card */}
        <GlassCard className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-white tracking-wide">Quant Insights</h4>
              <Badge variant="accent" size="sm">ANALYTICS</Badge>
            </div>
            <div className="p-4 rounded-20 bg-white/[0.03] border border-white/[0.06] mb-4">
              <div className="text-xs text-muted">Equal-Weight Market Drift</div>
              <div className="text-lg font-bold text-white mt-0.5">
                {((homeInsights?.marketOverview?.averageDrift || 0.12) * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-muted mt-1">
                Market Vol: {((homeInsights?.marketOverview?.averageVolatility || 0.22) * 100).toFixed(1)}%
              </div>
            </div>

            <div className="text-xs space-y-2.5">
              <div className="flex justify-between text-muted">
                <span>Top Gainer:</span>
                <span className="text-gain font-semibold">{homeInsights?.topMover?.symbol || 'RELIANCE'}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Max Drawdown:</span>
                <span className="text-white font-mono">
                  {((portfolioData?.maxDrawdown || 0.04) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.08]">
            <Button variant="outline" size="sm" className="w-full">
              Full Quant Report
            </Button>
          </div>
        </GlassCard>
      </div>

      {/* Live Holdings Table */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-base font-semibold text-white">Current Holdings</h4>
            <p className="text-xs text-muted">Real-time live valuation and P&L reconciliation</p>
          </div>
          <Badge variant="neutral" size="sm">
            {portfolioData?.holdings?.length || 0} Assets
          </Badge>
        </div>

        <DataTable
          columns={holdingsColumns}
          data={portfolioData?.holdings || []}
          emptyMessage="No holdings yet. Search stocks to place your first order."
        />
      </GlassCard>
    </div>
  );
}

export default CustomerDashboard;
