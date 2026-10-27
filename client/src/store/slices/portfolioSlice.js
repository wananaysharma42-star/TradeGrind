import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  summary: {
    cashBalance: null,
    cash: null,
    totalHoldingsValue: 0,
    holdingsValue: 0,
    totalPortfolioValue: null,
    totalValue: null,
    totalInvested: 0,
    totalUnrealizedPnl: 0,
    totalUnrealizedPnL: 0,
    totalUnrealizedPnlPercent: 0,
    dayPnL: 0,
    riskMetrics: {
      sharpeRatio: 0,
      portfolioVolatility: 0,
      maxDrawdown: 0
    }
  },
  holdings: [],
  allocations: [],
  performanceSeries: [],
  isLoading: true
};

const portfolioSlice = createSlice({
  name: 'portfolio',
  initialState,
  reducers: {
    setPortfolioData: (state, action) => {
      const data = action.payload || {};
      const cash = data.cash ?? data.cashBalance ?? 0;
      const totalVal = data.totalPortfolioValue ?? data.totalValue ?? cash;
      const holdingsVal = data.totalHoldingsValue ?? data.holdingsValue ?? 0;
      const pnl = data.totalUnrealizedPnl ?? data.totalUnrealizedPnL ?? 0;

      state.summary = {
        cashBalance: cash,
        cash,
        totalHoldingsValue: holdingsVal,
        holdingsValue: holdingsVal,
        totalPortfolioValue: totalVal,
        totalValue: totalVal,
        totalInvested: data.totalInvested ?? 0,
        totalUnrealizedPnl: pnl,
        totalUnrealizedPnL: pnl,
        totalUnrealizedPnlPercent: data.totalUnrealizedPnlPercent ?? 0,
        dayPnL: data.dayPnL ?? 0,
        riskMetrics: data.riskMetrics || state.summary.riskMetrics
      };
      state.holdings = data.holdings || [];
      state.allocations = data.allocations || [];
      state.performanceSeries = data.performanceSeries || [];
      state.isLoading = false;
    },
    // Real-time tick update pushed by server
    updateLivePortfolio: (state, action) => {
      const p = action.payload;
      if (!p) return;
      const cash = p.cash ?? p.cashBalance ?? state.summary.cashBalance;
      const totalVal = p.totalPortfolioValue ?? p.totalValue ?? state.summary.totalPortfolioValue;
      const holdingsVal = p.totalHoldingsValue ?? p.holdingsValue ?? state.summary.totalHoldingsValue;
      const pnl = p.totalUnrealizedPnl ?? p.totalUnrealizedPnL ?? state.summary.totalUnrealizedPnl;

      state.summary.cashBalance = cash;
      state.summary.cash = cash;
      state.summary.totalHoldingsValue = holdingsVal;
      state.summary.holdingsValue = holdingsVal;
      state.summary.totalPortfolioValue = totalVal;
      state.summary.totalValue = totalVal;
      state.summary.totalUnrealizedPnl = pnl;
      state.summary.totalUnrealizedPnL = pnl;
      if (p.dayPnL != null) state.summary.dayPnL = p.dayPnL;
      if (p.holdings) {
        state.holdings = p.holdings;
      }
    }
  }
});

export const { setPortfolioData, updateLivePortfolio } = portfolioSlice.actions;
export default portfolioSlice.reducer;
