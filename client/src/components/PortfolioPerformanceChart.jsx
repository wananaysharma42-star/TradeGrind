import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { TrendingUp, BarChart2 } from 'lucide-react';
import { formatINR, formatPercent } from '../utils/formatters.js';

export default function PortfolioPerformanceChart({ activeStock }) {
  const [activeRange, setActiveRange] = useState('1M');
  const portfolioSummary = useSelector(state => state.portfolio.summary);
  const performanceSeries = useSelector(state => state.portfolio.performanceSeries);

  const ranges = ['1D', '1W', '1M', '6M', '1Y'];

  // Determine chart title and data source:
  // If activeStock detail is provided, plot stock history; otherwise plot portfolio performance!
  const isStockView = !!activeStock;
  const title = isStockView ? `${activeStock.symbol} Price Action` : 'Portfolio Performance';
  const currentVal = isStockView ? activeStock.currentPrice : portfolioSummary.totalPortfolioValue;

  // Build synthetic or real series matching active range
  const chartData = React.useMemo(() => {
    if (isStockView && activeStock.priceHistory && activeStock.priceHistory.length > 5) {
      return activeStock.priceHistory.map(p => ({
        label: `T+${p.tick}`,
        value: p.price
      }));
    }

    // Default portfolio curve
    const base = currentVal * 0.95;
    const pointsCount = activeRange === '1D' ? 12 : activeRange === '1W' ? 14 : activeRange === '1M' ? 20 : 30;
    const result = [];
    let p = base;
    for (let i = 0; i < pointsCount; i++) {
      const step = (Math.sin(i / 2.5) + (i / pointsCount) * 1.5) * (currentVal * 0.015);
      p = Math.round((base + step + (i === pointsCount - 1 ? (currentVal - base - step) : 0)) * 100) / 100;
      result.push({
        label: activeRange === '1D' ? `${9 + Math.floor(i / 2)}:${i % 2 === 0 ? '15' : '45'}` : `Day ${i + 1}`,
        value: i === pointsCount - 1 ? currentVal : p
      });
    }
    return result;
  }, [isStockView, activeStock, currentVal, activeRange]);

  const firstVal = chartData[0]?.value || currentVal;
  const changeVal = currentVal - firstVal;
  const changePercent = firstVal > 0 ? (changeVal / firstVal) * 100 : 0;
  const isUp = changeVal >= 0;

  // Custom Floating Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const val = payload[0].value;
      const ptChange = val - firstVal;
      const ptPct = firstVal > 0 ? (ptChange / firstVal) * 100 : 0;
      const ptUp = ptChange >= 0;

      return (
        <div className="glass-panel p-3 border border-mauve/30 shadow-glass-glow text-left min-w-[140px] rounded-16">
          <div className="text-[10px] text-muted font-medium">{label}</div>
          <div className="text-sm font-bold text-white mt-0.5">{formatINR(val)}</div>
          <div className={`text-[10px] font-semibold mt-1 inline-flex items-center px-1.5 py-0.2 rounded-full ${
            ptUp ? 'bg-tradeGreen/15 text-tradeGreen' : 'bg-tradeRed/15 text-tradeRed'
          }`}>
            {formatPercent(ptPct)}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-panel p-6 flex flex-col justify-between">
      {/* Header: Title + Big Value + Range Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-mauve">
              <BarChart2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-white tracking-wide">{title}</span>
          </div>

          <div className="flex items-baseline space-x-3 mt-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {formatINR(currentVal)}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              isUp ? 'bg-tradeGreen/10 text-tradeGreen' : 'bg-tradeRed/10 text-tradeRed'
            }`}>
              {formatPercent(changePercent)}
            </span>
          </div>
        </div>

        {/* Range Pills (1D 1W 1M 6M 1Y) */}
        <div className="flex items-center space-x-1 bg-black/20 p-1 rounded-full border border-white/[0.06] self-start sm:self-auto">
          {ranges.map(range => (
            <button
              key={range}
              onClick={() => setActiveRange(range)}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                activeRange === range
                  ? 'bg-mauve/20 text-mauve-light border border-mauve/30 shadow-sm'
                  : 'text-muted hover:text-white'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Area Chart Container */}
      <div className="w-full h-64 sm:h-72 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {/* Smooth Mauve Gradient Fill */}
              <linearGradient id="mauveAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C9A6D8" stopOpacity={0.35} />
                <stop offset="60%" stopColor="#8E6AA5" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#5B4366" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            {/* Faint Horizontal Grid */}
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="rgba(255, 255, 255, 0.05)"
            />

            <XAxis
              dataKey="label"
              stroke="rgba(154, 145, 153, 0.6)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />

            <YAxis
              stroke="rgba(154, 145, 153, 0.6)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₹${Number(v).toLocaleString('en-IN', { notation: 'compact' })}`}
              domain={['auto', 'auto']}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="value"
              stroke="#C9A6D8"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#mauveAreaGradient)"
              activeDot={{
                r: 6,
                fill: '#C9A6D8',
                stroke: '#0B0709',
                strokeWidth: 2,
                className: 'filter drop-shadow-[0_0_8px_rgba(201,166,216,0.6)]'
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
