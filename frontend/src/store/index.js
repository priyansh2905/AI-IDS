import { configureStore } from '@reduxjs/toolkit';
import hidsReducer from './hidsSlice';

export const store = configureStore({
  reducer: {
    hids: hidsReducer,
  },
});
