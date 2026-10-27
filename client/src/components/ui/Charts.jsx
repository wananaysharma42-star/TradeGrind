import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  ReferenceLine,
  BarChart,
  Bar,
  Brush
} from 'recharts';
import clsx from 'clsx';
import { FilterPills } from '../ui/PillTabs.jsx';
import { formatINR } from '../../utils/formatters.js';
import { chartColors } from '../../theme/chartColors.js';

/**
 * PerformanceChart - Smooth area chart with Amber Gold line and gradient fill,
 * faint horizontal grid, glowing dot on hover, floating tooltip card on #1E1810, range pills.
 */
export function PerformanceChart({
  data = [],
  range = '1M',
  onRangeChange,
  title = 'Performance',
  valuePrefix = '₹',
  showRangePills = true,
  height = 280,
  className = ''
}) {
  const [activeRange, setActiveRange] = useState(range);

  const handleRangeChange = (newRange) => {
    setActiveRange(newRange);
    if (onRangeChange) onRangeChange(newRange);
  };

  const ranges = ['1D', '1W', '1M', '6M', '1Y'];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const val = payload[0].value;
      const firstVal = data[0]?.value || val;
      const pctChange = firstVal > 0 ? ((val - firstVal) / firstVal) * 100 : 0;
      const isPositive = pctChange >= 0;

      return (
        <div className="p-3 rounded-16 bg-raised border border-accent/30 backdrop-blur-glass shadow-glass text-xs">
          <div className="text-text-muted mb-1">{payload[0].payload.date || label}</div>
          <div className="text-base font-bold text-text">
            {valuePrefix}{Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={clsx('mt-1 font-semibold flex items-center', isPositive ? 'text-gain' : 'text-loss')}>
            {isPositive ? '+' : ''}{pctChange.toFixed(2)}%
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={clsx('w-full', className)}>
      <div className="flex items-center justify-between mb-4">
        {title && <h4 className="text-sm font-semibold text-text tracking-wide">{title}</h4>}
        {showRangePills && (
          <FilterPills
            options={ranges}
            value={activeRange}
            onChange={handleRangeChange}
          />
        )}
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="amberAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.accent} stopOpacity={0.30} />
                <stop offset="60%" stopColor={chartColors.accentDeep} stopOpacity={0.10} />
                <stop offset="100%" stopColor={chartColors.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
            <XAxis
              dataKey="date"
              stroke={chartColors.textMuted}
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke={chartColors.textMuted}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              tickFormatter={(v) => `${valuePrefix}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={chartColors.accent}
              strokeWidth={2}
              fill="url(#amberAreaGradient)"
              activeDot={{
                r: 6,
                stroke: chartColors.accent,
                strokeWidth: 2,
                fill: chartColors.accentDeep,
                className: 'animate-pulse'
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Sparkline - Minimal lightweight inline line chart without axes.
 * Positive = Green (#4ADE80), Negative = Red (#F87171).
 */
export function Sparkline({ data = [], isPositive = true, width = 100, height = 36 }) {
  const chartData = data.map((v, i) => ({ i, v }));
  const strokeColor = isPositive ? chartColors.gain : chartColors.loss;

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={strokeColor}
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * LiveLineChart - Real-time ticker line with gold glowing area.
 */
export function LiveLineChart({ data = [], height = 200 }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id="liveAmberGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColors.accent} stopOpacity={0.30} />
              <stop offset="100%" stopColor={chartColors.accent} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 2" stroke={chartColors.grid} vertical={false} />
          <XAxis dataKey="tick" stroke={chartColors.textMuted} fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke={chartColors.textMuted} fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
          <Area type="monotone" dataKey="price" stroke={chartColors.accent} strokeWidth={2} fill="url(#liveAmberGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * FanChart - Percentile bands in layered gold at 10/18/28% opacity
 * with median line in #F5B93B and target line dashed in #FAF5EA.
 */
export function FanChart({
  percentiles = { p5: [], p25: [], p50: [], p75: [], p95: [] },
  targetPrice = null,
  height = 260
}) {
  const len = percentiles.p50?.length || 0;
  const chartData = [];

  for (let d = 0; d < len; d++) {
    chartData.push({
      day: `Day ${d}`,
      p5: percentiles.p5?.[d],
      p25: percentiles.p25?.[d],
      p50: percentiles.p50?.[d],
      p75: percentiles.p75?.[d],
      p95: percentiles.p95?.[d],
      target: targetPrice
    });
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
          <XAxis dataKey="day" stroke={chartColors.textMuted} fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke={chartColors.textMuted} fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ backgroundColor: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder, borderRadius: '16px', fontSize: '11px', color: chartColors.textPrimary }}
          />
          {/* Layered Gold Percentile Bands */}
          <Area type="monotone" dataKey="p95" stroke="none" fill={chartColors.accent} fillOpacity={0.10} />
          <Area type="monotone" dataKey="p75" stroke="none" fill={chartColors.accent} fillOpacity={0.18} />
          <Area type="monotone" dataKey="p50" stroke={chartColors.accent} strokeWidth={2} fill={chartColors.accent} fillOpacity={0.28} />
          <Area type="monotone" dataKey="p25" stroke="none" fill={chartColors.accent} fillOpacity={0.18} />
          <Area type="monotone" dataKey="p5" stroke="none" fill={chartColors.accent} fillOpacity={0.10} />

          {targetPrice && (
            <ReferenceLine
              y={targetPrice}
              stroke={chartColors.fanChart.targetLine}
              strokeDasharray="4 4"
              label={{ value: `Target: ${formatINR(targetPrice)}`, fill: chartColors.fanChart.targetLine, fontSize: 11, position: 'top' }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * RebasedComparisonChart - Multi-line chart rebased to 100 with ordered series palette:
 * ['#F5B93B', '#E8E2D2', '#4FB3A9', '#C27A5B', '#8FA3C7', '#B7791F'].
 * Never uses red or green.
 */
export function RebasedComparisonChart({ series = [], height = 260 }) {
  if (!series.length) return null;

  const maxLen = Math.max(...series.map((s) => s.series.length));
  const chartData = [];

  for (let i = 0; i < maxLen; i++) {
    const point = { day: `D${i + 1}` };
    series.forEach((s) => {
      point[s.symbol] = s.series[i];
    });
    chartData.push(point);
  }

  const seriesPalette = chartColors.series;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
          <XAxis dataKey="day" stroke={chartColors.textMuted} fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke={chartColors.textMuted} fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ backgroundColor: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder, borderRadius: '16px', fontSize: '11px', color: chartColors.textPrimary }}
          />
          {series.map((s, idx) => (
            <Line
              key={s.symbol}
              type="monotone"
              dataKey={s.symbol}
              stroke={s.isOwn ? chartColors.accent : seriesPalette[(idx + 1) % seriesPalette.length]}
              strokeWidth={s.isOwn ? 2.5 : 1.5}
              dot={false}
            />
          ))}
          <Brush dataKey="day" height={20} stroke={chartColors.accent} fill={chartColors.glassSurface} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Histogram - Binned distribution chart with gold fill.
 * Supports profit/loss color differentiation when isProfitLoss is passed.
 */
export function Histogram({ bins = [], isProfitLoss = false, height = 200 }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bins} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
          <XAxis dataKey="range" stroke={chartColors.textMuted} fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke={chartColors.textMuted} fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ backgroundColor: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder, borderRadius: '16px', fontSize: '11px', color: chartColors.textPrimary }}
          />
          <Bar
            dataKey="count"
            fill={chartColors.accent}
            radius={[8, 8, 0, 0]}
            shape={isProfitLoss ? (props) => {
              const { x, y, width, height, payload } = props;
              const fill = (payload.range?.includes('-') || payload.value < 0) ? chartColors.loss : chartColors.gain;
              return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />;
            } : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * ProbabilityGauge - Semi-circle progress gauge for target hit probability.
 * Sequential ramp from #2B2315 (low) to #F5B93B (high).
 */
export function ProbabilityGauge({ probability = 0.5, size = 140 }) {
  const pct = Math.min(100, Math.max(0, Math.round(probability * 100)));
  const radius = 50;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <svg width={size} height={size / 1.7} viewBox="0 0 120 70">
        <path
          d="M 10 60 A 50 50 0 0 1 110 60"
          fill="none"
          stroke={chartColors.border}
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 10 60 A 50 50 0 0 1 110 60"
          fill="none"
          stroke="url(#gaugeAmberGradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id="gaugeAmberGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2B2315" />
            <stop offset="50%" stopColor="#B7791F" />
            <stop offset="100%" stopColor="#F5B93B" />
          </linearGradient>
        </defs>
      </svg>
      <div className="text-xl font-bold text-text mt-1">{pct}%</div>
      <div className="text-[11px] text-text-muted uppercase tracking-wider">Hit Probability</div>
    </div>
  );
}

/**
 * Heatmap - Matrix probability grid for What-If Target analysis.
 * Sequential ramp from #2B2315 (low) to #F5B93B (high).
 */
export function Heatmap({ grid = [], targets = [], days = [] }) {
  if (!grid || !grid.length) return null;

  let matrix = [];
  if (Array.isArray(grid[0])) {
    matrix = grid;
  } else {
    const tgList = targets.length ? targets : [...new Set(grid.map((g) => g.target))];
    const dyList = days.length ? days : [...new Set(grid.map((g) => g.days))];

    matrix = tgList.map((tg) =>
      dyList.map((dy) => {
        const item = grid.find((g) => Math.abs(g.target - tg) < 1.0 && g.days === dy);
        return item ? item.probability : 0;
      })
    );
  }

  const tgHeader = targets.length ? targets : matrix.map((_, i) => `T${i + 1}`);
  const dyHeader = days.length ? days : (matrix[0] ? matrix[0].map((_, i) => `${i + 1}`) : []);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center border-collapse text-xs">
        <thead>
          <tr>
            <th className="p-2 text-text-muted text-left font-medium">Target \ Days</th>
            {dyHeader.map((d) => (
              <th key={d} className="p-2 text-text-muted font-medium">{d}d</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, rIdx) => (
            <tr key={rIdx}>
              <td className="p-2 text-left font-semibold text-text">
                {typeof tgHeader[rIdx] === 'number' ? formatINR(tgHeader[rIdx]) : tgHeader[rIdx]}
              </td>
              {Array.isArray(row) && row.map((cell, cIdx) => {
                const prob = typeof cell === 'object' && cell !== null ? (cell.probability ?? 0) : (Number(cell) || 0);
                // Sequential ramp from #2B2315 to #F5B93B
                const alpha = Math.min(0.95, Math.max(0.15, prob));
                return (
                  <td key={cIdx} className="p-1.5">
                    <div
                      style={{
                        backgroundColor: `rgba(245, 185, 59, ${alpha})`,
                        color: alpha > 0.5 ? '#0C0A07' : '#FAF5EA'
                      }}
                      className="py-1.5 px-2 rounded-10 font-mono font-bold transition-transform hover:scale-110"
                    >
                      {(prob * 100).toFixed(0)}%
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * CandleChart - Stock candlestick visualizer.
 * Up candle = Gain (#4ADE80), Down candle = Loss (#F87171), Wick = Muted (#A39578).
 */
export function CandleChart({ candles = [], height = 240 }) {
  const chartData = candles.map((c) => ({
    day: `D${c.simDay}`,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    isUp: c.close >= c.open,
    bodyBase: Math.min(c.open, c.close),
    bodyHeight: Math.max(0.01, Math.abs(c.close - c.open))
  }));

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
          <XAxis dataKey="day" stroke={chartColors.textMuted} fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke={chartColors.textMuted} fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ backgroundColor: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder, borderRadius: '16px', fontSize: '11px', color: chartColors.textPrimary }}
          />
          <Bar
            dataKey="bodyHeight"
            fill={chartColors.accent}
            shape={(props) => {
              const { x, y, width, height, payload } = props;
              const fill = payload.isUp ? chartColors.gain : chartColors.loss;
              return <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} />;
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
