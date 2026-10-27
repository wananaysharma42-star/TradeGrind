import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  stocks: [],
  activeStock: null,
  simTime: {
    day: 1,
    timeStr: '09:15 AM',
    formatted: 'Day 1 • 09:15 AM'
  },
  globalTick: 0,
  priceFlashes: {}, // symbol -> 'green' | 'red'
  filter: 'ALL',    // 'ALL' | 'GAINERS' | 'LOSERS' | 'VOLUME'
  searchQuery: '',
  selectedPeriod: '1D', // '1D' | '1W' | '1M' | '6M' | '1Y'
  isLoading: true
};

const marketSlice = createSlice({
  name: 'market',
  initialState,
  reducers: {
    setInitialStocks: (state, action) => {
      state.stocks = action.payload;
      state.isLoading = false;
    },
    setActiveStock: (state, action) => {
      state.activeStock = action.payload;
    },
    // Buffered update for 1-second batch from socket
    processMarketTick: (state, action) => {
      const payload = action.payload;
      if (!payload) return;

      const stocks = Array.isArray(payload) ? payload : payload.stocks;
      const simTime = payload.simTime;
      const globalTick = payload.globalTick;

      if (simTime) state.simTime = simTime;
      if (globalTick != null) state.globalTick = globalTick;

      const newFlashes = { ...state.priceFlashes };

      // Update stocks and compute price flash directions
      if (stocks && stocks.length > 0) {
        if (state.stocks.length === 0) {
          state.stocks = stocks;
        } else {
          state.stocks = state.stocks.map((oldStock) => {
            const matching = stocks.find(
              (s) => s.symbol === oldStock.symbol || s.stockId === oldStock.stockId || s.stockId === oldStock._id
            );
            if (!matching) return oldStock;
            const newPrice = matching.price ?? matching.currentPrice;
            if (newPrice != null && oldStock.currentPrice !== newPrice) {
              newFlashes[oldStock.symbol] = newPrice > oldStock.currentPrice ? 'green' : 'red';
            }
            return {
              ...oldStock,
              ...matching,
              price: newPrice,
              currentPrice: newPrice,
              changePct: matching.changePct ?? matching.dayChangePercent ?? oldStock.changePct,
              dayChangePercent: matching.changePct ?? matching.dayChangePercent ?? oldStock.dayChangePercent,
              dayHigh: matching.dayHigh ?? oldStock.dayHigh,
              dayLow: matching.dayLow ?? oldStock.dayLow,
              volume: matching.volume ?? oldStock.volume
            };
          });
        }

        state.priceFlashes = newFlashes;
      }

      // If active stock is open, update its live price
      if (state.activeStock && stocks) {
        const matching = stocks.find(
          (s) => s.symbol === state.activeStock.symbol || s.stockId === state.activeStock.stockId || s.stockId === state.activeStock._id
        );
        if (matching) {
          const newPrice = matching.price ?? matching.currentPrice;
          state.activeStock = {
            ...state.activeStock,
            ...matching,
            price: newPrice,
            currentPrice: newPrice,
            dayChangePercent: matching.changePct ?? matching.dayChangePercent ?? state.activeStock.dayChangePercent
          };
        }
      }
    },
    processStockDetailTick: (state, action) => {
      if (state.activeStock && state.activeStock.symbol === action.payload.symbol) {
        state.activeStock = {
          ...state.activeStock,
          ...action.payload
        };
      }
    },
    clearPriceFlash: (state, action) => {
      const symbol = action.payload;
      if (state.priceFlashes[symbol]) {
        delete state.priceFlashes[symbol];
      }
    },
    setFilter: (state, action) => {
      state.filter = action.payload;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    setSelectedPeriod: (state, action) => {
      state.selectedPeriod = action.payload;
    }
  }
});

export const {
  setInitialStocks,
  setActiveStock,
  processMarketTick,
  processStockDetailTick,
  clearPriceFlash,
  setFilter,
  setSearchQuery,
  setSelectedPeriod
} = marketSlice.actions;

export default marketSlice.reducer;
