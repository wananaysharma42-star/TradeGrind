import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  targets: [],
  isLoading: true
};

const targetSlice = createSlice({
  name: 'target',
  initialState,
  reducers: {
    setTargets: (state, action) => {
      state.targets = action.payload;
      state.isLoading = false;
    },
    addTarget: (state, action) => {
      state.targets.unshift(action.payload);
    },
    removeTarget: (state, action) => {
      state.targets = state.targets.filter(t => t._id !== action.payload && t.id !== action.payload);
    },
    updateTargetLive: (state, action) => {
      const { targetId, status, probability, remainingDays } = action.payload;
      const target = state.targets.find(t => (t._id || t.id) === targetId);
      if (target) {
        if (status) target.status = status;
        if (probability !== undefined) target.currentProbability = probability;
        if (remainingDays !== undefined) target.remainingDays = remainingDays;
      }
    }
  }
});

export const { setTargets, addTarget, removeTarget, updateTargetLive } = targetSlice.actions;
export default targetSlice.reducer;
