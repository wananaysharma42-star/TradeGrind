import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { api } from './services/api.js';
import { setCredentials, logout } from './store/slices/authSlice.js';
import { setInitialStocks } from './store/slices/marketSlice.js';
import { setNotifications } from './store/slices/notificationSlice.js';
import { initSocket, disconnectSocket } from './services/socket.js';
import { useSocket } from './hooks/useSocket.js';

// Layout & Guards
import { AppShell } from './components/layout/AppShell.jsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.jsx';

// Pages
import { LandingPage } from './pages/LandingPage.jsx';
import { Login } from './pages/auth/Login.jsx';
import { Register } from './pages/auth/Register.jsx';
// Customer Views
import { CustomerDashboardView } from './pages/customer/CustomerDashboardView.jsx';
import { MarketBrowseView } from './pages/customer/MarketBrowseView.jsx';
import { StockDetailView } from './pages/customer/StockDetailView.jsx';
import { CustomerPortfolioView } from './pages/customer/CustomerPortfolioView.jsx';
import { ProbabilityAnalysisView } from './pages/customer/ProbabilityAnalysisView.jsx';
import { CustomerAlertsView } from './pages/customer/CustomerAlertsView.jsx';
// Company Views
import { CompanyDashboardView } from './pages/company/CompanyDashboardView.jsx';
import { ProfitAnalyticsView } from './pages/company/ProfitAnalyticsView.jsx';
import { CustomerAnalysisView } from './pages/company/CustomerAnalysisView.jsx';
import { TestingEnvironmentView } from './pages/company/TestingEnvironmentView.jsx';
import { CompanyAlertsView } from './pages/company/CompanyAlertsView.jsx';

import { MethodologyView } from './pages/MethodologyView.jsx';

export default function App() {
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  // Initialize socket hook
  useSocket();

  // Rehydrate auth via /api/auth/me on mount
  useEffect(() => {
    async function rehydrateSession() {
      const token = localStorage.getItem('tradesim_token');
      if (token) {
        try {
          const me = await api.getMe();
          dispatch(setCredentials({ user: me, token }));
        } catch (err) {
          console.warn('Session expired or invalid, logging out', err);
          dispatch(logout());
        }
      }
    }

    async function loadBootstrapData() {
      const token = localStorage.getItem('tradesim_token');
      try {
        const stocks = await api.getStocks();
        if (stocks) dispatch(setInitialStocks(stocks));

        if (token) {
          const notifs = await api.getNotifications().catch(() => null);
          if (notifs) dispatch(setNotifications(notifs));
        }
      } catch (err) {
        // silent fail on network / unauthenticated
      }
    }

    rehydrateSession();
    loadBootstrapData();

    return () => {
      disconnectSocket();
    };
  }, [dispatch]);

  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Authenticated Customer Routes (supports both /customer/* and top-level paths) */}
      <Route
        element={
          <ProtectedRoute allowedRole="CUSTOMER">
            <AppShell />
          </ProtectedRoute>
        }
      >
        {/* Dashboard */}
        <Route path="/dashboard" element={<CustomerDashboardView />} />
        <Route path="/customer" element={<CustomerDashboardView />} />
        <Route path="/customer/dashboard" element={<CustomerDashboardView />} />

        {/* Market / Browse */}
        <Route path="/market" element={<MarketBrowseView />} />
        <Route path="/customer/market" element={<MarketBrowseView />} />

        {/* Stock Detail */}
        <Route path="/stock/:id" element={<StockDetailView />} />
        <Route path="/customer/stock/:id" element={<StockDetailView />} />

        {/* Portfolio */}
        <Route path="/portfolio" element={<CustomerPortfolioView />} />
        <Route path="/customer/portfolio" element={<CustomerPortfolioView />} />

        {/* Probability Analysis */}
        <Route path="/analysis" element={<ProbabilityAnalysisView />} />
        <Route path="/customer/analysis" element={<ProbabilityAnalysisView />} />

        {/* Alerts */}
        <Route path="/alerts" element={<CustomerAlertsView />} />
        <Route path="/customer/alerts" element={<CustomerAlertsView />} />

        {/* Methodology */}
        <Route path="/methodology" element={<MethodologyView />} />
        <Route path="/customer/methodology" element={<MethodologyView />} />
      </Route>

      {/* Authenticated Company Routes */}
      <Route
        element={
          <ProtectedRoute allowedRole="COMPANY">
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/company" element={<CompanyDashboardView />} />
        <Route path="/company/dashboard" element={<CompanyDashboardView />} />
        <Route path="/company/analytics" element={<ProfitAnalyticsView />} />
        <Route path="/company/customers" element={<CustomerAnalysisView />} />
        <Route path="/company/testing" element={<TestingEnvironmentView />} />
        <Route path="/company/alerts" element={<CompanyAlertsView />} />
        <Route path="/company/methodology" element={<MethodologyView />} />
      </Route>

      {/* Fallback Catch-All */}
      <Route
        path="*"
        element={
          <Navigate
            to={
              isAuthenticated
                ? user?.role === 'COMPANY'
                  ? '/company'
                  : '/dashboard'
                : '/'
            }
            replace
          />
        }
      />
    </Routes>
  );
}
