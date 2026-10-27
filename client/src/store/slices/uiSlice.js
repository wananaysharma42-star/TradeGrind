import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeTab: 'market',
  orderModalOpen: false,
  orderModalStock: null,
  orderModalAction: 'BUY',
  targetModalOpen: false,
  targetModalStock: null,
  stockDetailModalOpen: false,
  stockDetailSymbol: null,
  notificationDrawerOpen: false,
  authModalOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    openOrderModal: (state, action) => {
      state.orderModalOpen = true;
      state.orderModalStock = action.payload?.symbol || 'RELIANCE';
      state.orderModalAction = action.payload?.action || 'BUY';
    },
    closeOrderModal: (state) => {
      state.orderModalOpen = false;
    },
    openTargetModal: (state, action) => {
      state.targetModalOpen = true;
      state.targetModalStock = action.payload?.symbol || 'RELIANCE';
    },
    closeTargetModal: (state) => {
      state.targetModalOpen = false;
    },
    openStockDetailModal: (state, action) => {
      state.stockDetailModalOpen = true;
      state.stockDetailSymbol = action.payload;
    },
    closeStockDetailModal: (state) => {
      state.stockDetailModalOpen = false;
      state.stockDetailSymbol = null;
    },
    toggleNotificationDrawer: (state) => {
      state.notificationDrawerOpen = !state.notificationDrawerOpen;
    },
    setNotificationDrawerOpen: (state, action) => {
      state.notificationDrawerOpen = action.payload;
    },
    setAuthModalOpen: (state, action) => {
      state.authModalOpen = action.payload;
    },
  },
});

export const {
  setActiveTab,
  openOrderModal,
  closeOrderModal,
  openTargetModal,
  closeTargetModal,
  openStockDetailModal,
  closeStockDetailModal,
  toggleNotificationDrawer,
  setNotificationDrawerOpen,
  setAuthModalOpen,
} = uiSlice.actions;

export default uiSlice.reducer;
