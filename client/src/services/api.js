/**
 * Centralized API service with JWT authentication, cookie support, and standardized error handling.
 */
import { getCookie } from '../utils/cookies.js';

const BASE_URL = `${(import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/+$/, '')}/api`;

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('tradegrind_token') || localStorage.getItem('tradesim_token') || getCookie('tradegrind_token') || getCookie('tradesim_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    const errorMsg = data.error?.message || response.statusText || 'Request failed';
    const err = new Error(errorMsg);
    err.status = response.status;
    err.code = data.error?.code;
    err.details = data.error?.details;
    throw err;
  }

  return data.data;
}

export const api = {
  // Auth
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (payload) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  getMe: () => apiRequest('/auth/me'),

  // Stocks
  getStocks: () => apiRequest('/stocks'),
  getStock: (symbolOrId) => apiRequest(`/stocks/${symbolOrId}`),

  // Orders
  getOrders: () => apiRequest('/orders'),
  placeOrder: (order) => apiRequest('/orders', { method: 'POST', body: JSON.stringify(order) }),
  cancelOrder: (id) => apiRequest(`/orders/${id}`, { method: 'DELETE' }),

  // Trading
  buyStock: (trade) => apiRequest('/trade/buy', { method: 'POST', body: JSON.stringify(trade) }),
  sellStock: (trade) => apiRequest('/trade/sell', { method: 'POST', body: JSON.stringify(trade) }),

  // Portfolio & History
  getPortfolio: () => apiRequest('/portfolio'),
  getPortfolioHistory: (range = '1M') => apiRequest(`/portfolio/history?range=${range}`),
  getTransactions: (page = 1, limit = 20) => apiRequest(`/transactions?page=${page}&limit=${limit}`),

  // Watchlist
  getWatchlist: (filter = 'all') => apiRequest(`/watchlist?filter=${filter}`),
  addToWatchlist: (stockId) => apiRequest(`/watchlist/${stockId}`, { method: 'POST' }),
  removeFromWatchlist: (stockId) => apiRequest(`/watchlist/${stockId}`, { method: 'DELETE' }),

  // Targets & Probability
  getTargets: () => apiRequest('/targets'),
  createTarget: (target) => apiRequest('/targets', { method: 'POST', body: JSON.stringify(target) }),
  deleteTarget: (id) => apiRequest(`/targets/${id}`, { method: 'DELETE' }),
  analyseTarget: (params) => apiRequest('/targets/analyse', { method: 'POST', body: JSON.stringify(params) }),
  whatIfTargets: (payload) => apiRequest('/targets/what-if', { method: 'POST', body: JSON.stringify(payload) }),

  // Insights
  getStockInsights: (stockId) => apiRequest(`/stocks/${stockId}/insights`),
  getTrendingStocks: () => apiRequest('/stocks/trending'),
  getHomeInsights: () => apiRequest('/insights/home'),

  // Alerts
  getAlerts: () => apiRequest('/alerts'),
  createAlert: (rule) => apiRequest('/alerts', { method: 'POST', body: JSON.stringify(rule) }),
  updateAlert: (id, updates) => apiRequest(`/alerts/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteAlert: (id) => apiRequest(`/alerts/${id}`, { method: 'DELETE' }),
  previewAlert: (payload) => apiRequest('/alerts/preview', { method: 'POST', body: JSON.stringify(payload) }),

  // Notifications
  getNotifications: () => apiRequest('/notifications'),
  markNotificationRead: (id) => apiRequest(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => apiRequest('/notifications/read-all', { method: 'PATCH' }),

  // Dev Testing
  devShock: (stockId, pct) => apiRequest('/dev/shock', { method: 'POST', body: JSON.stringify({ stockId, pct }) }),
  devSpeed: (multiplier) => apiRequest('/dev/speed', { method: 'POST', body: JSON.stringify({ multiplier }) }),

  // Company Role
  getCompanyHome: () => apiRequest('/company/home'),
  getCompanyProfitAnalytics: (compare) =>
    apiRequest(`/company/profit-analytics${compare ? `?compare=${encodeURIComponent(compare)}` : ''}`),
  getCompanyCustomers: (category) =>
    apiRequest(`/company/customers${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  getCompanyCustomerTrend: () => apiRequest('/company/customers/trend'),
  runCompanySimulate: (params) => apiRequest('/company/simulate', { method: 'POST', body: JSON.stringify(params) }),
  saveCompanyScenario: (payload) => apiRequest('/company/simulate/save', { method: 'POST', body: JSON.stringify(payload) }),
  getCompanyScenarios: () => apiRequest('/company/simulations'),
  deleteCompanyScenario: (id) => apiRequest(`/company/simulations/${id}`, { method: 'DELETE' }),

  // Legacy/Alias
  getCompanyStock: () => apiRequest('/company/home'),
  getCompanyHolders: (category) => apiRequest(`/company/customers${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  runCompanySimulation: (params) => apiRequest('/company/simulate', { method: 'POST', body: JSON.stringify(params) })
};
