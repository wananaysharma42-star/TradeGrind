import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  Building2,
  Users,
  Sliders,
  TrendingUp,
  Percent,
  Play,
  RotateCcw,
  ShieldAlert,
  Coins
} from 'lucide-react';
import { formatINR, formatPercent } from '../utils/formatters.js';
import { api } from '../services/api.js';
import { chartColors } from '../theme/chartColors.js';

export default function CompanyPortal({ activeSubTab = 'overview' }) {
  const [stock, setStock] = useState(null);
  const [holdersData, setHoldersData] = useState(null);
  const [simParams, setSimParams] = useState({
    horizonDays: 90,
    deltaMu: 0.04,          // +4% revenue boost
    deltaSigma: -0.02,       // -2% volatility stabilization
    shareAdjustmentPercent: -2, // 2% share buyback
    dividendPerShare: 10     // ₹10 cash dividend
  });
  const [simulationResult, setSimulationResult] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load stock overview and holders
  useEffect(() => {
    async function loadData() {
      try {
        const [stockRes, holdersRes] = await Promise.all([
          api.getCompanyStock(),
          api.getCompanyHolders()
        ]);
        setStock(stockRes);
        setHoldersData(holdersRes);

        // Run default simulation
        const simRes = await api.runCompanySimulation({
          horizonDays: 90,
          deltaMu: 0.04,
          deltaSigma: -0.02,
          shareAdjustmentPercent: -2,
          dividendPerShare: 10
        });
        setSimulationResult(simRes);
      } catch (err) {
        console.error('Error loading company data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleRunSimulation = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await api.runCompanySimulation(simParams);
      setSimulationResult(res);
    } catch (err) {
      console.error('Simulation error:', err);
    }
  };

  if (loading || !stock) {
    return (
      <div className="py-20 text-center text-text-muted text-sm glass-panel m-4">
        Loading Corporate Stock Data & Holders...
      </div>
    );
  }

  const isGain = stock.dayChange >= 0;

  return (
    <div className="space-y-6 text-text">
      {/* Top Banner: Company Stock Identity */}
      <div className="glass-panel p-6 border border-border relative overflow-hidden bg-surface/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-accent-deep flex items-center justify-center font-bold text-xl text-[#0C0A07] shadow-glass-glow">
              {stock.symbol.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-text tracking-tight">{stock.companyName}</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-accent/20 text-accent border border-accent/30">
                  {stock.symbol}
                </span>
              </div>
              <div className="text-xs text-text-muted mt-0.5">{stock.sector} • Corporate Owner Terminal</div>
            </div>
          </div>

          <div className="flex items-center space-x-6 self-start md:self-auto">
            <div>
              <div className="text-[11px] text-text-muted">Simulated Price</div>
              <div className="text-2xl font-bold text-text tracking-tight">
                {formatINR(stock.currentPrice)}
              </div>
              <div className={`text-xs font-semibold ${isGain ? 'text-gain' : 'text-loss'}`}>
                {formatPercent(stock.dayChangePercent)} today
              </div>
            </div>

            <div className="border-l border-border pl-6">
              <div className="text-[11px] text-text-muted">Market Capitalization</div>
              <div className="text-xl font-bold text-text">
                {formatINR(stock.marketCap, true)}
              </div>
              <div className="text-xs text-text-muted">{stock.sharesOutstanding?.toLocaleString('en-IN')} shares</div>
            </div>
          </div>
        </div>

        {/* 4 Overview Mini Tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-border">
          <div className="glass-tile p-3 rounded-16 border border-border bg-surface/60">
            <div className="text-[10px] text-text-muted uppercase">Annualized Drift (&mu;)</div>
            <div className="text-base font-bold text-text mt-0.5">{(stock.mu * 100).toFixed(1)}%</div>
          </div>
          <div className="glass-tile p-3 rounded-16 border border-border bg-surface/60">
            <div className="text-[10px] text-text-muted uppercase">Annual Volatility (&sigma;)</div>
            <div className="text-base font-bold text-text mt-0.5">{(stock.sigma * 100).toFixed(1)}%</div>
          </div>
          <div className="glass-tile p-3 rounded-16 border border-border bg-surface/60">
            <div className="text-[10px] text-text-muted uppercase">Public Float Stake</div>
            <div className="text-base font-bold text-text mt-0.5">{holdersData?.publicFloatPercent || 0}%</div>
          </div>
          <div className="glass-tile p-3 rounded-16 border border-border bg-surface/60">
            <div className="text-[10px] text-text-muted uppercase">Top 5 Concentration</div>
            <div className="text-base font-bold text-text mt-0.5">{holdersData?.top5ConcentrationPercent || 0}%</div>
          </div>
        </div>
      </div>

      {/* Main Grid: What-If Engine & Holders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): What-If Simulation Engine */}
        <div className="lg:col-span-2 glass-panel p-6 flex flex-col justify-between border border-border bg-surface/40">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center border border-accent/25">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text">Deterministic What-If Scenario Projection</h3>
                  <div className="text-[11px] text-text-muted">Geometric Brownian Motion Corridor Simulation (10th, 50th, 90th Percentiles)</div>
                </div>
              </div>
            </div>

            {/* Projection Area Chart */}
            <div className="w-full h-64 my-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={simulationResult?.trajectory || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="corridorAmberGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.accent} stopOpacity={0.30} />
                      <stop offset="95%" stopColor={chartColors.accentDeep} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                  <XAxis dataKey="day" stroke={chartColors.textMuted} fontSize={11} tickFormatter={(d) => `Day ${d}`} />
                  <YAxis stroke={chartColors.textMuted} fontSize={11} tickFormatter={(v) => `₹${Number(v).toFixed(0)}`} domain={['auto', 'auto']} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="p-3 bg-raised border border-accent/30 shadow-glass-glow text-left min-w-[150px] rounded-16 text-text">
                            <div className="text-[11px] text-text-muted font-bold">Horizon: Day {data.day}</div>
                            <div className="text-xs text-gain font-semibold mt-1">90th Pct: {formatINR(data.p90)}</div>
                            <div className="text-xs text-text font-bold">Median (50th): {formatINR(data.p50)}</div>
                            <div className="text-xs text-loss font-semibold">10th Pct: {formatINR(data.p10)}</div>
                            <div className="text-[10px] text-accent mt-1">Cap: {formatINR(data.marketCapExpected, true)}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {/* 90th percentile corridor */}
                  <Area type="monotone" dataKey="p90" stroke={chartColors.gain} strokeDasharray="3 3" fillOpacity={0} strokeWidth={1.5} />
                  {/* 50th percentile median */}
                  <Area type="monotone" dataKey="p50" stroke={chartColors.accent} fill="url(#corridorAmberGradient)" strokeWidth={2.5} />
                  {/* 10th percentile corridor */}
                  <Area type="monotone" dataKey="p10" stroke={chartColors.loss} strokeDasharray="3 3" fillOpacity={0} strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Projection Outcome Badges */}
            {simulationResult && (
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-20 bg-surface border border-border mt-3 text-center">
                <div>
                  <div className="text-[10px] text-text-muted uppercase">Terminal Median Price</div>
                  <div className="text-sm font-bold text-text mt-0.5">{formatINR(simulationResult.projected.terminalMedianPrice)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase">Projected Market Cap</div>
                  <div className="text-sm font-bold text-accent mt-0.5">{formatINR(simulationResult.projected.projectedMarketCap, true)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase">Cap Change %</div>
                  <div className={`text-sm font-bold mt-0.5 ${simulationResult.projected.marketCapChangePercent >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {formatPercent(simulationResult.projected.marketCapChangePercent)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controls: Interactive Scenario Sliders */}
          <form onSubmit={handleRunSimulation} className="mt-5 pt-4 border-t border-border space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Drift shock slider */}
              <div>
                <div className="flex justify-between text-xs font-medium text-text-muted mb-1">
                  <span>Drift Shock (&Delta;&mu;)</span>
                  <span className="text-text font-bold">{formatPercent(simParams.deltaMu * 100)}</span>
                </div>
                <input
                  type="range"
                  min="-0.15"
                  max="0.15"
                  step="0.01"
                  value={simParams.deltaMu}
                  onChange={(e) => setSimParams({ ...simParams, deltaMu: parseFloat(e.target.value) })}
                  className="w-full accent-accent cursor-pointer"
                />
              </div>

              {/* Volatility shock slider */}
              <div>
                <div className="flex justify-between text-xs font-medium text-text-muted mb-1">
                  <span>Volatility Shock (&Delta;&sigma;)</span>
                  <span className="text-text font-bold">{formatPercent(simParams.deltaSigma * 100)}</span>
                </div>
                <input
                  type="range"
                  min="-0.10"
                  max="0.15"
                  step="0.01"
                  value={simParams.deltaSigma}
                  onChange={(e) => setSimParams({ ...simParams, deltaSigma: parseFloat(e.target.value) })}
                  className="w-full accent-accent cursor-pointer"
                />
              </div>

              {/* Share adjustment (Dilution / Buyback) */}
              <div>
                <div className="flex justify-between text-xs font-medium text-text-muted mb-1">
                  <span>Shares (Buyback/Dilution)</span>
                  <span className="text-text font-bold">{formatPercent(simParams.shareAdjustmentPercent)}</span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="40"
                  step="1"
                  value={simParams.shareAdjustmentPercent}
                  onChange={(e) => setSimParams({ ...simParams, shareAdjustmentPercent: parseInt(e.target.value) })}
                  className="w-full accent-accent cursor-pointer"
                />
              </div>

              {/* Dividend Payout */}
              <div>
                <div className="flex justify-between text-xs font-medium text-text-muted mb-1">
                  <span>Dividend per Share</span>
                  <span className="text-text font-bold">{formatINR(simParams.dividendPerShare)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={simParams.dividendPerShare}
                  onChange={(e) => setSimParams({ ...simParams, dividendPerShare: parseInt(e.target.value) })}
                  className="w-full accent-accent cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-text-muted">Horizon:</span>
                {[30, 90, 180, 252].map(days => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setSimParams({ ...simParams, horizonDays: days })}
                    className={`px-2.5 py-1 text-[11px] rounded-full transition-all ${
                      simParams.horizonDays === days
                        ? 'bg-accent/20 text-accent border border-accent/30 font-bold'
                        : 'glass-pill text-text-muted hover:text-text'
                    }`}
                  >
                    {days} Days
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className="px-5 py-2 rounded-full bg-accent text-[#0C0A07] font-bold text-xs hover:bg-accent/90 transition-all flex items-center space-x-1.5 shadow-glass-glow cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Re-Simulate</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column (1 col): Shareholders Breakdown */}
        <div className="glass-panel p-6 border border-border flex flex-col justify-between bg-surface/40">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center border border-accent/25">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">Shareholders Register</h3>
                <div className="text-[11px] text-text-muted">{holdersData?.totalHolders || 0} Registered Customer Holders</div>
              </div>
            </div>

            {/* Holders List */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {!holdersData?.holders || holdersData.holders.length === 0 ? (
                <div className="py-12 text-center text-text-muted text-xs">
                  No customer trading orders recorded on this stock yet.
                </div>
              ) : (
                holdersData.holders.map((holder, idx) => (
                  <div key={holder.holderId || idx} className="p-3 rounded-20 glass-tile border border-border flex items-center justify-between bg-surface/50">
                    <div>
                      <div className="text-xs font-bold text-text">{holder.name}</div>
                      <div className="text-[10px] text-text-muted">{holder.shares} shares owned</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-text">{formatINR(holder.value)}</div>
                      <div className="text-[10px] text-accent font-semibold">{holder.stakePercent}% stake</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-border text-[11px] text-text-muted leading-relaxed">
            Corporate analytics are derived strictly via deterministic portfolio allocations. Promoter retention is {100 - (holdersData?.publicFloatPercent || 0)}%.
          </div>
        </div>
      </div>
    </div>
  );
}
