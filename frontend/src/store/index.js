import { configureStore } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import groupReducer from './groupSlice';
import telemetryReducer from './telemetrySlice';

export const store = configureStore({
  reducer: {
    user: userReducer,
    group: groupReducer,
    telemetry: telemetryReducer,
  },
});
