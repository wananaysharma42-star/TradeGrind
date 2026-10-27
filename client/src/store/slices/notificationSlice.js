import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  notifications: [],
  unreadCount: 0,
  isOpen: false
};

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    setNotifications: (state, action) => {
      state.notifications = action.payload.notifications;
      state.unreadCount = action.payload.unreadCount;
    },
    addNotification: (state, action) => {
      state.notifications.unshift(action.payload);
      state.unreadCount += 1;
    },
    markRead: (state, action) => {
      const id = action.payload;
      const notif = state.notifications.find(n => n._id === id);
      if (notif && !notif.read) {
        notif.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllRead: (state) => {
      state.notifications.forEach(n => { n.read = true; });
      state.unreadCount = 0;
    },
    toggleNotificationDrawer: (state) => {
      state.isOpen = !state.isOpen;
    },
    setNotificationDrawerOpen: (state, action) => {
      state.isOpen = action.payload;
    }
  }
});

export const {
  setNotifications,
  addNotification,
  markRead,
  markAllRead,
  toggleNotificationDrawer,
  setNotificationDrawerOpen
} = notificationSlice.actions;

export default notificationSlice.reducer;
