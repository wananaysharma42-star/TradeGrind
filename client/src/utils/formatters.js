/**
 * Currency and numbers formatting utilities for Indian Rupee (₹)
 */

export const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
});

export const inrCompactFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 2
});

export function formatINR(amount, compact = false) {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0.00';
  return compact ? inrCompactFormatter.format(amount) : inrFormatter.format(amount);
}

export function formatNumber(val, decimals = 2) {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return Number(val).toLocaleString('en-IN', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals
  });
}

export function formatPercent(val) {
  if (val === undefined || val === null || isNaN(val)) return '0.00%';
  const num = Number(val);
  const prefix = num > 0 ? '+' : '';
  return `${prefix}${num.toFixed(2)}%`;
}

export function getInitials(symbol = '') {
  if (!symbol) return 'TS';
  return symbol.slice(0, 2).toUpperCase();
}

const STOCK_COLORS = [
  '#F5B93B', // Primary Gold
  '#B7791F', // Deep Bronze
  '#C27A5B', // Warm Terra-cotta
  '#A39578', // Muted Gold
  '#8C7A5B', // Earth Umber
  '#E8E2D2', // Soft Ivory
  '#D4A373', // Light Ochre
  '#6B614C', // Deep Ochre
  '#9C8E75', // Sandstone
  '#B89758'  // Antique Brass
];

export function getStockColor(symbol = '') {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % STOCK_COLORS.length;
  return STOCK_COLORS[index];
}
