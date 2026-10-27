import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Users,
  DollarSign,
  TrendingUp,
  Activity,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard.jsx';
import { StatTile, NumberFlash, StockLogo, Badge } from '../../components/ui/StatTile.jsx';
import { PerformanceChart, FanChart } from '../../components/ui/Charts.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { api } from '../../services/api.js';
import { formatINR } from '../../utils/formatters.js';

export function CompanyDashboard() {
  const [homeData, setHomeData] = useState(null);
  const [profitAnalytics, setProfitAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCompanyData() {
      try {
        const [home, profit] = await Promise.all([
          api.getCompanyHome().catch(() => null),
          api.getProfitAnalytics().catch(() => null)
        ]);
        if (home) setHomeData(home);
        if (profit) setProfitAnalytics(profit);
      } catch (err) {
        console.warn('Company dashboard load error', err);
      } finally {
        setLoading(false);
      }
    }
    loadCompanyData();
  }, []);

  const stock = homeData?.stock;
  const ranks = homeData?.ranks;
  const risk = homeData?.riskMetrics;

  const historyTableColumns = [
    { header: 'Sim Day', accessor: 'simDay', render: (d) => `Day ${d}` },
    { header: 'Open', accessor: 'open', render: (v) => formatINR(v) },
    { header: 'High', accessor: 'high', render: (v) => formatINR(v) },
    { header: 'Low', accessor: 'low', render: (v) => formatINR(v) },
    { header: 'Close', accessor: 'close', render: (v) => formatINR(v) },
    {
      header: 'Return',
      accessor: 'returnPercent',
      render: (r) => (
        <span className={Number(r) >= 0 ? 'text-trade-green font-semibold' : 'text-trade-red font-semibold'}>
          {Number(r) >= 0 ? '+' : ''}{Number(r).toFixed(2)}%
        </span>
      )
    },
    { header: 'Volume', accessor: 'volume', render: (v) => Number(v).toLocaleString() },
    { header: 'Volatility', accessor: 'volatilityPercent', render: (v) => `${Number(v).toFixed(2)}%` }
  ];

  return (
    <div className="space-y-6">
      {/* KPI Tiles Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Live Stock Price"
          value={<NumberFlash value={stock?.currentPrice || 100} formatter={(v) => formatINR(v)} />}
          subvalue={stock?.symbol || 'ACME'}
          icon={<DollarSign className="w-4 h-4 text-mauve" />}
        />
        <StatTile
          label="Market Overall Rank"
          value={`#${ranks?.overallRank || 1} of ${ranks?.totalCompanies || 1}`}
          subvalue={`Sector Rank: #${ranks?.sectorRank || 1}`}
          icon={<TrendingUp className="w-4 h-4 text-mauve" />}
        />
        <StatTile
          label="Composite Factor Score"
          value={`${ranks?.score || 50}/100`}
          subvalue="Multi-factor rank percentile"
          icon={<Activity className="w-4 h-4 text-mauve" />}
        />
        <StatTile
          label="Estimated Volatility"
          value={`${((risk?.estimatedVolatility || 0.22) * 100).toFixed(1)}%`}
          subvalue="Blended Sample + EWMA"
          icon={<Layers className="w-4 h-4 text-mauve" />}
        />
      </div>

      {/* 30-Day Fan Chart + Scoring Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-semibold text-white">30-Day Monte Carlo Forecast Cone</h4>
              <p className="text-xs text-muted">Percentile uncertainty bands (5th, 25th, 50th, 75th, 95th)</p>
            </div>
            {profitAnalytics?.fanChart30Days?.probabilityHigher != null && (
              <Badge variant="mauve" size="sm">
                P(Higher): {(profitAnalytics.fanChart30Days.probabilityHigher * 100).toFixed(1)}%
              </Badge>
            )}
          </div>
          {profitAnalytics?.fanChart30Days ? (
            <FanChart percentiles={profitAnalytics.fanChart30Days.percentiles} />
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-muted">Loading projection...</div>
          )}
        </GlassCard>

        {/* Factor Score Breakdown Card */}
        <GlassCard className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-white">Score Breakdown</h4>
              <Badge variant="mauve" size="sm">FACTORS</Badge>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-muted mb-1">
                  <span>30-Day Return Rank (40%):</span>
                  <span className="font-semibold text-white">
                    {Number(ranks?.components?.returnRank || 50).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-mauve h-full" style={{ width: `${ranks?.components?.returnRank || 50}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-muted mb-1">
                  <span>Sharpe Ratio Rank (25%):</span>
                  <span className="font-semibold text-white">
                    {Number(ranks?.components?.sharpeRank || 50).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-mauve h-full" style={{ width: `${ranks?.components?.sharpeRank || 50}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-muted mb-1">
                  <span>Inverse Volatility Rank (20%):</span>
                  <span className="font-semibold text-white">
                    {Number(ranks?.components?.invVolRank || 50).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-mauve h-full" style={{ width: `${ranks?.components?.invVolRank || 50}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-muted mb-1">
                  <span>Inverse Max Drawdown (15%):</span>
                  <span className="font-semibold text-white">
                    {Number(ranks?.components?.invMddRank || 50).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-mauve h-full" style={{ width: `${ranks?.components?.invMddRank || 50}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.08] text-xs text-muted">
            1-Day 95% VaR: <span className="text-white font-mono font-semibold">${risk?.valueAtRisk95_1Day?.toFixed(2) || '0.00'}</span>
          </div>
        </GlassCard>
      </div>

      {/* Last 10 Simulated Days Table */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-base font-semibold text-white">Last 10 Simulated Days</h4>
            <p className="text-xs text-muted">Audit trail of daily price action, return, volume, and volatility</p>
          </div>
          <Badge variant="neutral" size="sm">Sim Day History</Badge>
        </div>

        <DataTable
          columns={historyTableColumns}
          data={homeData?.last10Days || []}
          emptyMessage="No historical daily candles available yet."
        />
      </GlassCard>
    </div>
  );
}

export default CompanyDashboard;
