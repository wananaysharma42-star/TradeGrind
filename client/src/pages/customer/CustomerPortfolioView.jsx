import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  PieChart as PieIcon,
  TrendingUp,
  Activity,
  History,
  Target,
  Bell,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { GlassCard } from '../../components/ui/GlassCard.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge, NumberFlash, StockLogo, StatTile } from '../../components/ui/StatTile.jsx';
import { PerformanceChart } from '../../components/ui/Charts.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { api } from '../../services/api.js';
import { formatINR } from '../../utils/formatters.js';
import { chartColors } from '../../theme/chartColors.js';

export function CustomerPortfolioView() {
  const user = useSelector((state) => state.auth.user);
  const liveSummary = useSelector((state) => state.portfolio.summary);
  const navigate = useNavigate();

  const [portfolioData, setPortfolioData] = useState(null);
  const [historySeries, setHistorySeries] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeRange, setActiveRange] = useState('1M');

  useEffect(() => {
    async function loadPortfolioData() {
      try {
        const [port, hist, txs] = await Promise.all([
          api.getPortfolio().catch(() => null),
          api.getPortfolioHistory('1M').catch(() => null),
          api.getTransactions(1, 10).catch(() => null)
        ]);

        if (port) setPortfolioData(port);
        if (hist?.series) setHistorySeries(hist.series);
        if (txs?.transactions) setTransactions(txs.transactions);
      } catch (err) {
        console.warn('Portfolio load error', err);
      }
    }
    loadPortfolioData();
  }, []);

  const handleRangeChange = async (r) => {
    setActiveRange(r);
    try {
      const res = await api.getPortfolioHistory(r);
      if (res?.series) setHistorySeries(res.series);
    } catch (err) {
      // ignore
    }
  };

  const totalValue = liveSummary?.totalPortfolioValue ?? liveSummary?.totalValue ?? portfolioData?.totalPortfolioValue ?? portfolioData?.totalValue ?? user?.virtualBalance ?? 1000000;
  const cashBalance = liveSummary?.cashBalance ?? liveSummary?.cash ?? portfolioData?.cashBalance ?? portfolioData?.cash ?? user?.virtualBalance ?? 1000000;
  const unrealizedPnL = liveSummary?.totalUnrealizedPnl ?? liveSummary?.totalUnrealizedPnL ?? portfolioData?.totalUnrealizedPnl ?? portfolioData?.totalUnrealizedPnL ?? 0;
  const pnlPercent = liveSummary?.totalUnrealizedPnlPercent ?? portfolioData?.totalUnrealizedPnlPercent ?? (totalValue > 0 ? (unrealizedPnL / totalValue) * 100 : 0);
  const holdings = portfolioData?.holdings || [];

  // Chart data
  const chartPoints = historySeries.length > 0
    ? historySeries.map((pt) => ({
        date: pt.date || `Day ${pt.simDay || 1}`,
        value: pt.portfolioValue || pt.totalValue || totalValue
      }))
    : [{ date: 'Today', value: totalValue }];

  // Allocation donut data
  const donutColors = chartColors.series;
  const allocationData = holdings.map((h, idx) => ({
    name: h.symbol,
    value: Math.round(h.marketValue || (h.quantity * (h.currentPrice || 100))),
    color: donutColors[idx % donutColors.length]
  }));

  if (cashBalance > 0) {
    allocationData.push({
      name: 'Cash',
      value: Math.round(cashBalance),
      color: chartColors.border
    });
  }

  const holdingsColumns = [
    {
      header: 'Stock',
      accessor: 'symbol',
      render: (sym, row) => (
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate(`/customer/stock/${sym}`)}>
          <StockLogo symbol={sym} size="sm" />
          <div>
            <div className="font-bold text-white text-sm">{sym}</div>
            <div className="text-[10px] text-muted">{row.name}</div>
          </div>
        </div>
      )
    },
    { header: 'Shares', accessor: 'quantity', render: (q) => Number(q).toLocaleString() },
    { header: 'Avg Cost', accessor: 'avgBuyPrice', render: (p) => formatINR(p) },
    {
      header: 'Market Price',
      accessor: 'currentPrice',
      render: (p) => <NumberFlash value={p || 100} formatter={(v) => formatINR(v)} />
    },
    {
      header: 'Total Value',
      accessor: 'marketValue',
      render: (val, row) => formatINR(val || (row.quantity * (row.currentPrice || 0)))
    },
    {
      header: 'P&L (₹ / %)',
      accessor: 'unrealizedPnL',
      render: (pnl, row) => {
        const val = Number(pnl || row.pnl || 0);
        const isProfit = val >= 0;
        return (
          <span className={isProfit ? 'text-gain font-semibold' : 'text-loss font-semibold'}>
            {isProfit ? '+' : ''}{formatINR(Math.abs(val))} ({isProfit ? '+' : ''}{Number(row.pnlPercent || row.unrealizedPnLPercent || 0).toFixed(2)}%)
          </span>
        );
      }
    },
    {
      header: 'Weight',
      accessor: 'allocationPercent',
      render: (w, row) => {
        const val = Number(w ?? (totalValue > 0 ? ((row.marketValue || (row.quantity * (row.currentPrice || 0))) / totalValue) * 100 : 0));
        return `${val.toFixed(1)}%`;
      }
    }
  ];

  const transactionColumns = [
    {
      header: 'Type',
      accessor: 'type',
      render: (t) => (
        <Badge variant={t === 'BUY' ? 'positive' : 'negative'} size="sm">
          {t}
        </Badge>
      )
    },
    {
      header: 'Asset',
      accessor: 'stockId',
      render: (stock) => <span className="font-semibold text-white">{stock?.symbol || 'STOCK'}</span>
    },
    { header: 'Shares', accessor: 'quantity' },
    { header: 'Exec Price', accessor: 'price', render: (p) => formatINR(p) },
    { header: 'Fee', accessor: 'fee', render: (f) => formatINR(f) },
    { header: 'Sim Day', accessor: 'simDay', render: (d) => `Day ${d}` },
    {
      header: 'Timestamp',
      accessor: 'createdAt',
      render: (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Portfolio Quick Links Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Portfolio Profile</h2>
          <p className="text-xs text-muted">Complete holdings breakdown, allocation donut, and activity feed</p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/customer/analysis')}
            icon={<Target className="w-4 h-4 text-accent" />}
          >
            Probability Analysis
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/customer/alerts')}
            icon={<Bell className="w-4 h-4 text-accent" />}
          >
            Alert Rules
          </Button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Total Portfolio Equity"
          value={<NumberFlash value={totalValue} formatter={(v) => formatINR(v)} />}
          change={pnlPercent}
          subvalue="vs inception capital"
        />
        <StatTile
          label="Unrealized P&L"
          value={`${unrealizedPnL >= 0 ? '+' : ''}${formatINR(Math.abs(unrealizedPnL))}`}
          subvalue={`${pnlPercent.toFixed(2)}% net returns`}
        />
        <StatTile
          label="Cash Reserve"
          value={formatINR(cashBalance)}
          subvalue="Instant buying power"
        />
        <StatTile
          label="Sharpe / Volatility"
          value={`${Number(portfolioData?.riskMetrics?.sharpeRatio ?? portfolioData?.sharpeRatio ?? 0).toFixed(2)} / ${(((portfolioData?.riskMetrics?.portfolioVolatility ?? portfolioData?.portfolioVolatility) || 0) * 100).toFixed(1)}%`}
          subvalue="Institutional ratio"
        />
      </div>

      {/* Equity Curve + Allocation Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2">
          <PerformanceChart
            title="Equity Curve Evolution"
            range={activeRange}
            onRangeChange={handleRangeChange}
            data={chartPoints}
          />
        </GlassCard>

        {/* Allocation Donut */}
        <GlassCard className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-white">Asset Allocation</h4>
              <Badge variant="accent" size="sm">WEIGHTS</Badge>
            </div>
            <div className="h-48 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {allocationData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} stroke="rgba(0,0,0,0.5)" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder, borderRadius: '16px', fontSize: '11px', color: chartColors.textPrimary }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5 mt-2">
              {allocationData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-muted">{item.name}</span>
                  </div>
                  <span className="text-white font-mono font-medium">
                    ${Number(item.value).toLocaleString()} ({totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Holdings Table */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-bold text-white">Holdings & Live P&L</h4>
          <span className="text-xs text-muted font-mono">{holdings.length} Active Positions</span>
        </div>
        <DataTable
          columns={holdingsColumns}
          data={holdings}
          emptyMessage="You have no open stock positions."
        />
      </GlassCard>

      {/* Recent Activity Feed */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-accent" />
            <h4 className="text-base font-bold text-white">Recent Activity Feed</h4>
          </div>
          <span className="text-xs text-muted font-mono">Last 10 Executions</span>
        </div>
        <DataTable
          columns={transactionColumns}
          data={transactions}
          emptyMessage="No executed transactions found."
        />
      </GlassCard>
    </div>
  );
}

export default CustomerPortfolioView;
