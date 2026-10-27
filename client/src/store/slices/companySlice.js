import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  stock: null,
  holders: [],
  analytics: {
    publicFloatPercent: 0,
    top5ConcentrationPercent: 0,
    totalHolders: 0,
  },
  simulationResult: null,
  isLoading: false,
};

const companySlice = createSlice({
  name: 'company',
  initialState,
  reducers: {
    setCompanyStock: (state, action) => {
      state.stock = action.payload;
    },
    setCompanyHolders: (state, action) => {
      state.holders = action.payload.holders || [];
      state.analytics = {
        publicFloatPercent: action.payload.publicFloatPercent || 0,
        top5ConcentrationPercent: action.payload.top5ConcentrationPercent || 0,
        totalHolders: action.payload.totalHolders || 0,
      };
    },
    setSimulationResult: (state, action) => {
      state.simulationResult = action.payload;
    },
    updateCompanyPriceLive: (state, action) => {
      if (state.stock && state.stock.symbol === action.payload.symbol) {
        state.stock.currentPrice = action.payload.currentPrice;
        state.stock.dayChange = action.payload.dayChange;
        state.stock.dayChangePercent = action.payload.dayChangePercent;
        state.stock.marketCap = action.payload.marketCap;
      }
    },
  },
});

export const {
  setCompanyStock,
  setCompanyHolders,
  setSimulationResult,
  updateCompanyPriceLive,
} = companySlice.actions;

export default companySlice.reducer;
