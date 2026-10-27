/**
 * TradeGrind Theme Chart Tokens
 * Single source of truth for Recharts components and canvas visualisations.
 */
export const chartColors = {
  // Brand Accents
  accent: '#F5B93B',
  accentDeep: '#B7791F',
  accentSoft: 'rgba(245, 185, 59, 0.12)',

  // Surfaces & Backgrounds
  bg: '#0C0A07',
  surface: '#17130C',
  raised: '#1E1810',
  border: '#2B2315',
  glassSurface: 'rgba(245, 185, 59, 0.04)',
  glassBorder: 'rgba(245, 185, 59, 0.10)',

  // Chart specific fills & grids
  areaFillStart: 'rgba(245, 185, 59, 0.30)',
  areaFillEnd: 'rgba(245, 185, 59, 0.00)',
  lineStroke: '#F5B93B',
  grid: 'rgba(245, 185, 59, 0.07)',
  guideLine: 'rgba(245, 185, 59, 0.50)',
  halo: 'rgba(245, 185, 59, 0.35)',

  // Tooltip
  tooltipBg: '#1E1810',
  tooltipBorder: '#2B2315',
  tooltipBorderGlow: 'rgba(245, 185, 59, 0.25)',

  // Typography
  textPrimary: '#FAF5EA',
  textMuted: '#A39578',
  textDisabled: '#6B614C',

  // Gain & Loss (strictly reserved for financial outcome, never series or brand)
  gain: '#4ADE80',
  loss: '#F87171',
  gainTint: 'rgba(74, 222, 128, 0.20)',
  lossTint: 'rgba(248, 113, 113, 0.20)',

  // Rebased Peers Ordered Series Palette
  // Lines stay distinguishable on dark gold; red & green never used
  series: [
    '#F5B93B', // Primary gold
    '#E8E2D2', // Soft ivory
    '#4FB3A9', // Mineral teal
    '#C27A5B', // Warm terra-cotta
    '#8FA3C7', // Slate periwinkle
    '#B7791F'  // Deep bronze
  ],

  // Fan Chart Percentile Bands
  fanChart: {
    p95: 'rgba(245, 185, 59, 0.10)',
    p75: 'rgba(245, 185, 59, 0.18)',
    p50: '#F5B93B',
    p50Fill: 'rgba(245, 185, 59, 0.28)',
    p25: 'rgba(245, 185, 59, 0.18)',
    p5: 'rgba(245, 185, 59, 0.10)',
    targetLine: '#FAF5EA'
  },

  // Heatmap & Probability Gauge Sequential Ramp
  ramp: {
    low: '#2B2315',
    mid: '#B7791F',
    high: '#F5B93B'
  },

  // Testing Environment
  testing: {
    baseline: '#E8E2D2',
    scenario: '#F5B93B'
  }
};

export default chartColors;
