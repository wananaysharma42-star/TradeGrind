import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  alerts: [],
  activeAlertsCount: 0,
  isLoading: false,
};

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    setAlerts: (state, action) => {
      state.alerts = action.payload;
      state.activeAlertsCount = action.payload.filter(a => a.status === 'ACTIVE').length;
      state.isLoading = false;
    },
    addAlert: (state, action) => {
      state.alerts.unshift(action.payload);
      state.activeAlertsCount += 1;
    },
    removeAlert: (state, action) => {
      state.alerts = state.alerts.filter(a => a.id !== action.payload && a._id !== action.payload);
      state.activeAlertsCount = state.alerts.filter(a => a.status === 'ACTIVE').length;
    },
    triggerAlert: (state, action) => {
      const alert = state.alerts.find(a => (a.id || a._id) === action.payload);
      if (alert) {
        alert.status = 'TRIGGERED';
        state.activeAlertsCount = Math.max(0, state.activeAlertsCount - 1);
      }
    },
  },
});

export const { setAlerts, addAlert, removeAlert, triggerAlert } = alertsSlice.actions;
export default alertsSlice.reducer;
