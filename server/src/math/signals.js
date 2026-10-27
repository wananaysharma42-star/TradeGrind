/**
 * signals.js - "Quant Insights" generator (deterministic, numbers + neutral labels only):
 *
 * Converts technical and statistical indicator values into rule-based statements using fixed thresholds.
 * Examples:
 * - "RSI 72.4 (above 70 band)"
 * - "Price is +1.8σ above its 20-day mean"
 * - "30-day volatility is in the top quartile of all stocks"
 *
 * NEVER advises buying or selling.
 */

import { rsi, zScorePrice, bollingerBands, momentum } from './indicators.js';
import { sampleStd, logReturns } from './returns.js';

/**
 * Generates neutral, quantitative insight statements for a given stock based on its price series
 * and optional cross-sectional universe metrics.
 *
 * @param {Object} params
 * @param {number[]} params.prices - Historical price series (chronological)
 * @param {string} [params.symbol] - Stock symbol
 * @param {number[]} [params.marketVolatilities] - Cross-sectional array of 30-day volatilities of all stocks
 * @returns {Array<{ category: string, label: string, value: number, statement: string }>}
 */
export function generateQuantInsights({
  prices,
  symbol = 'Stock',
  marketVolatilities = []
}) {
  if (!prices || prices.length < 5) return [];

  const insights = [];
  const currentPrice = prices[prices.length - 1];

  // 1. RSI-14
  if (prices.length >= 15) {
    const rsiVal = rsi(prices, 14);
    const roundedRsi = Math.round(rsiVal * 10) / 10;
    let rsiLabel = 'neutral';
    let rsiStatement = `RSI ${roundedRsi} (within 30-70 band)`;

    if (rsiVal >= 70) {
      rsiLabel = 'overbought_band';
      rsiStatement = `RSI ${roundedRsi} (above 70 band)`;
    } else if (rsiVal <= 30) {
      rsiLabel = 'oversold_band';
      rsiStatement = `RSI ${roundedRsi} (below 30 band)`;
    }

    insights.push({
      category: 'Momentum',
      label: rsiLabel,
      value: roundedRsi,
      statement: rsiStatement
    });
  }

  // 2. Price Z-Score vs 20-day moving average
  if (prices.length >= 20) {
    const zScore = zScorePrice(prices, 20);
    if (zScore !== null) {
      const roundedZ = Math.round(zScore * 10) / 10;
      const signStr = roundedZ >= 0 ? `+${roundedZ}` : `${roundedZ}`;
      const direction = roundedZ >= 0 ? 'above' : 'below';
      const statement = `Price is ${signStr}σ ${direction} its 20-day mean`;

      insights.push({
        category: 'MeanReversion',
        label: Math.abs(roundedZ) >= 2.0 ? 'extreme_deviation' : 'normal_variation',
        value: roundedZ,
        statement
      });
    }
  }

  // 3. Bollinger Bands status
  if (prices.length >= 20) {
    const bb = bollingerBands(prices, 20, 2);
    if (bb) {
      const bw = Math.round(bb.bandwidth * 1000) / 10; // in %
      let bbLabel = 'inside_bands';
      let bbStatement = `Trading within Bollinger Bands (Bandwidth ${bw}%)`;

      if (currentPrice > bb.upper) {
        bbLabel = 'above_upper_band';
        bbStatement = `Price ₹${currentPrice.toFixed(2)} exceeds upper Bollinger Band ₹${bb.upper.toFixed(2)}`;
      } else if (currentPrice < bb.lower) {
        bbLabel = 'below_lower_band';
        bbStatement = `Price ₹${currentPrice.toFixed(2)} is below lower Bollinger Band ₹${bb.lower.toFixed(2)}`;
      }

      insights.push({
        category: 'Volatility',
        label: bbLabel,
        value: bw,
        statement: bbStatement
      });
    }
  }

  // 4. Momentum (10-day return)
  if (prices.length >= 11) {
    const mom10 = momentum(prices, 10);
    if (mom10 !== null) {
      const momPct = Math.round(mom10 * 1000) / 10;
      const sign = momPct >= 0 ? '+' : '';
      insights.push({
        category: 'Trend',
        label: momPct >= 0 ? 'positive_momentum' : 'negative_momentum',
        value: momPct,
        statement: `10-day return is ${sign}${momPct}%`
      });
    }
  }

  // 5. Cross-sectional Volatility Quartile
  if (prices.length >= 20 && Array.isArray(marketVolatilities) && marketVolatilities.length >= 4) {
    const dailyR = logReturns(prices.slice(-30));
    const stockVol = sampleStd(dailyR) * Math.sqrt(252);

    const sortedVols = [...marketVolatilities].sort((a, b) => a - b);
    const n = sortedVols.length;
    const q1 = sortedVols[Math.floor(0.25 * n)];
    const q2 = sortedVols[Math.floor(0.50 * n)];
    const q3 = sortedVols[Math.floor(0.75 * n)];

    let quartileStr = 'second quartile';
    if (stockVol >= q3) {
      quartileStr = 'top quartile of all stocks';
    } else if (stockVol >= q2) {
      quartileStr = 'third quartile of all stocks';
    } else if (stockVol <= q1) {
      quartileStr = 'bottom quartile of all stocks';
    }

    insights.push({
      category: 'CrossSectional',
      label: 'volatility_quartile',
      value: Math.round(stockVol * 1000) / 10,
      statement: `30-day volatility is in the ${quartileStr}`
    });
  }

  return insights;
}
