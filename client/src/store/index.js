import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice.js';
import marketReducer from './slices/marketSlice.js';
import portfolioReducer from './slices/portfolioSlice.js';
import targetReducer from './slices/targetSlice.js';
import alertsReducer from './slices/alertsSlice.js';
import companyReducer from './slices/companySlice.js';
import uiReducer from './slices/uiSlice.js';
import notificationReducer from './slices/notificationSlice.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    market: marketReducer,
    portfolio: portfolioReducer,
    targets: targetReducer,
    target: targetReducer,
    alerts: alertsReducer,
    company: companyReducer,
    ui: uiReducer,
    notification: notificationReducer,
  },
});

export default store;
