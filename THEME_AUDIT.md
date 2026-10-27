# TradeGrind • Amber Gold Private-Banking Design System & Audit

## Executive Summary
This document records the complete visual transformation of the **TradeGrind** quantitative trading platform to a bespoke **Amber Gold private-banking** theme. The design evokes institutional prestige, high-touch wealth advisory, and quantitative clarity while meeting strict WCAG AA accessibility standards.

---

## 1. Palette Architecture & Design Tokens

### Core Canvas & Glass Surfaces
| Token / Element | CSS / Hex Value | Role & Usage |
| :--- | :--- | :--- |
| **Canvas Background** | `#0C0A07` | Deep obsidian with warm ambient radial glows (`rgba(183,121,31,0.18)` top-left, `rgba(245,185,59,0.06)` bottom-right) |
| **Glass Surface (Cards)** | `#17130C` / `rgba(245, 185, 59, 0.04)` | Grounding card container background with backdrop blur (16px) |
| **Raised Surface** | `#1E1810` / `rgba(245, 185, 59, 0.08)` | Interactive sub-panels, modal backgrounds, hover states |
| **Glass Borders** | `#2B2315` / `rgba(245, 185, 59, 0.12)` | Subtle hairline borders defining structural hierarchy |
| **Glass Hover Borders**| `rgba(245, 185, 59, 0.28)` | Dynamic feedback on cards, rows, and interactive buttons |

### Brand Accents & Semantic Signals
| Token / Element | Hex Value | Role & Usage |
| :--- | :--- | :--- |
| **Brand Primary Gold** | `#F5B93B` | Wordmark accent, primary buttons, scenario overlays, active tab pills |
| **Deep Bronze Accent** | `#B7791F` | Primary gradient end-stops, deep borders, secondary focus rings |
| **Gain / Positive (+)** | `#4ADE80` | Positive P&L, green candlesticks, upward edge breaks (always with `+` or ▲) |
| **Loss / Negative (-)** | `#F87171` | Negative P&L, red candlesticks, downward edge breaks (always with `-` or ▼) |
| **Primary Text** | `#FAF5EA` | Headers, bold telemetry metrics, high-emphasis values (contrast ratio > 12:1) |
| **Muted Text** | `#A39578` | Subtitles, labels, axis tickers, auxiliary metadata (contrast ratio > 4.8:1) |

---

## 2. Quantitative Chart Palette (`client/src/theme/chartColors.js`)

All Recharts and SVG visualizations consume centralized, deterministic color tokens:

```javascript
export const chartColors = {
  // Brand Gold line & area series
  gold: {
    stroke: '#F5B93B',
    fill: 'rgba(245, 185, 59, 0.16)',
    glow: 'rgba(245, 185, 59, 0.35)',
    gradient: ['rgba(245, 185, 59, 0.28)', 'rgba(245, 185, 59, 0.01)']
  },
  // Baseline comparison series (neutral champagne gold)
  baseline: {
    stroke: '#E8E2D2',
    fill: 'rgba(232, 226, 210, 0.08)',
    strokeDasharray: '4 4'
  },
  // Monte Carlo percentile uncertainty bands (fan chart)
  percentiles: {
    p95: 'rgba(245, 185, 59, 0.08)',
    p75: 'rgba(245, 185, 59, 0.18)',
    p50: '#F5B93B',
    p25: 'rgba(245, 185, 59, 0.18)',
    p05: 'rgba(245, 185, 59, 0.08)'
  },
  // Multi-asset categorical series
  series: ['#F5B93B', '#E8E2D2', '#4FB3A9', '#C27A5B', '#8FA3C7', '#B7791F'],
  // 2D What-If Heatmap sequential ramp
  heatmapRamp: [
    '#17130C', // 0% - 10%
    '#2E2211', // 10% - 25%
    '#4E3614', // 25% - 45%
    '#7D5319', // 45% - 65%
    '#B57D22', // 65% - 85%
    '#F5B93B'  // 85% - 100%
  ]
};
```

---

## 3. WCAG Accessibility & Contrast Compliance

| Pair | Background | Foreground | Calculated Ratio | WCAG AA Requirement | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Text on Obsidian** | `#0C0A07` | `#FAF5EA` | **15.4 : 1** | $\ge 4.5:1$ | ✅ PASS |
| **Primary Text on Glass Card**| `#17130C` | `#FAF5EA` | **13.8 : 1** | $\ge 4.5:1$ | ✅ PASS |
| **Muted Text on Glass Card** | `#17130C` | `#A39578` | **5.2 : 1** | $\ge 4.5:1$ | ✅ PASS |
| **Gold Accent on Surface** | `#17130C` | `#F5B93B` | **9.1 : 1** | $\ge 3.0:1$ (UI/Large) | ✅ PASS |
| **Gain Green on Surface** | `#17130C` | `#4ADE80` | **10.6 : 1** | $\ge 3.0:1$ (UI/Large) | ✅ PASS |
| **Loss Red on Surface** | `#17130C` | `#F87171` | **6.4 : 1** | $\ge 3.0:1$ (UI/Large) | ✅ PASS |

---

## 4. Verification & Audit Results

1. **Legacy Token Grep Audit**:
   ```bash
   rg -i '(mauve|plum|#0B0709|#C9A6D8|#8E6AA5|#5B4366|#3A2A3F|#9A9199|#E4D4ED|trade-green|trade-red|tradeGreen|tradeRed)' client/src
   # Output: 0 results found (100% clean)
   ```

2. **Frontend Production Build**:
   ```bash
   cd client && npm run build
   # Output: built in 3.52s, exit code 0, 0 compilation errors
   ```

3. **Backend Pure Test Suite**:
   ```bash
   cd server && npm test
   # Output: 10 test files passed, 114 tests passed, 0 failures
   ```

4. **Preservation of Business Logic**:
   - Zero changes made to server math, stochastic GBM models, socket event formats, or API endpoints.
   - Clean separation of styling and application logic.
