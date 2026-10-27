import { createSlice } from '@reduxjs/toolkit';

const token = localStorage.getItem('tradesim_token');
const savedUser = localStorage.getItem('tradesim_user');

const initialState = {
  token: token || null,
  user: savedUser ? JSON.parse(savedUser) : null,
  isAuthenticated: !!token,
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
      state.error = null;
      localStorage.setItem('tradesim_token', token);
      localStorage.setItem('tradesim_user', JSON.stringify(user));
    },
    updateVirtualBalance: (state, action) => {
      if (state.user) {
        state.user.virtualBalance = action.payload;
        localStorage.setItem('tradesim_user', JSON.stringify(state.user));
      }
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      localStorage.removeItem('tradesim_token');
      localStorage.removeItem('tradesim_user');
    },
    setError: (state, action) => {
      state.error = action.payload;
    }
  }
});

export const { setCredentials, updateVirtualBalance, logout, setError } = authSlice.actions;
export default authSlice.reducer;
