import { createSlice } from '@reduxjs/toolkit';
import { getCookie, setCookie, deleteCookie } from '../../utils/cookies.js';

const initialToken = (typeof window !== 'undefined' ? (localStorage.getItem('tradegrind_token') || localStorage.getItem('tradesim_token')) : null) || getCookie('tradegrind_token') || getCookie('tradesim_token');
let initialSavedUser = null;
try {
  const raw = typeof window !== 'undefined' ? (localStorage.getItem('tradegrind_user') || localStorage.getItem('tradesim_user')) : null;
  if (raw) initialSavedUser = JSON.parse(raw);
} catch (e) {
  // ignore
}

const hasSessionCookie = !!(getCookie('tradegrind_token') || getCookie('tradegrind_session') || getCookie('tradesim_token') || getCookie('tradesim_session') || initialToken);

const initialState = {
  token: initialToken || null,
  user: initialSavedUser || null,
  isAuthenticated: !!(initialToken && initialSavedUser),
  isRehydrating: hasSessionCookie, // true if there is a cookie/token to rehydrate
  isLoading: false,
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
      state.isAuthenticated = true;
      state.isRehydrating = false;
      state.error = null;
      if (typeof window !== 'undefined') {
        localStorage.setItem('tradegrind_token', token);
        localStorage.setItem('tradegrind_user', JSON.stringify(user));
        localStorage.removeItem('tradesim_token');
        localStorage.removeItem('tradesim_user');
      }
      setCookie('tradegrind_token', token, 15);
      setCookie('tradegrind_session', 'active', 15);
      deleteCookie('tradesim_token');
      deleteCookie('tradesim_session');
    },
    setRehydrationComplete: (state) => {
      state.isRehydrating = false;
    },
    updateVirtualBalance: (state, action) => {
      if (state.user) {
        state.user.virtualBalance = action.payload;
        if (typeof window !== 'undefined') {
          localStorage.setItem('tradegrind_user', JSON.stringify(state.user));
        }
      }
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isRehydrating = false;
      state.error = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('tradegrind_token');
        localStorage.removeItem('tradegrind_user');
        localStorage.removeItem('tradesim_token');
        localStorage.removeItem('tradesim_user');
      }
      deleteCookie('tradegrind_token');
      deleteCookie('tradegrind_session');
      deleteCookie('tradesim_token');
      deleteCookie('tradesim_session');
    },
    setError: (state, action) => {
      state.error = action.payload;
    }
  }
});

export const { setCredentials, setRehydrationComplete, updateVirtualBalance, logout, setError } = authSlice.actions;
export default authSlice.reducer;
