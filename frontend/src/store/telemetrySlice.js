import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  processes: [],
  alerts: [],
  events: [],
  selectedPid: null,
  selectedProcessDetails: null,
  wsConnected: false,
  searchQuery: '',
  filterSeverity: 'ALL'
};

const telemetrySlice = createSlice({
  name: 'telemetry',
  initialState,
  reducers: {
    setProcesses: (state, action) => {
      state.processes = action.payload;
    },
    updateProcess: (state, action) => {
      const index = state.processes.findIndex(p => p.pid === action.payload.pid);
      if (index !== -1) {
        state.processes[index] = { ...state.processes[index], ...action.payload };
      } else {
        state.processes.unshift(action.payload);
      }
    },
    setAlerts: (state, action) => {
      state.alerts = action.payload;
    },
    updateAlert: (state, action) => {
      const index = state.alerts.findIndex(a => a.pid === action.payload.pid);
      if (index !== -1) {
        state.alerts[index] = action.payload;
      } else {
        state.alerts.unshift(action.payload);
      }
    },
    setEvents: (state, action) => {
      state.events = action.payload;
    },
    addEvent: (state, action) => {
      state.events.push(action.payload);
      if (state.events.length > 100) {
        state.events.shift();
      }
    },
    updateMitigation: (state, action) => {
      const { pid, status } = action.payload;
      state.processes = state.processes.map(p =>
        p.pid === pid ? { ...p, status } : p
      );
      state.alerts = state.alerts.map(a =>
        a.pid === pid ? { ...a, status } : a
      );
      if (state.selectedProcessDetails && state.selectedProcessDetails.process.pid === pid) {
        state.selectedProcessDetails.process.status = status;
      }
    },
    setSelectedPid: (state, action) => {
      state.selectedPid = action.payload;
    },
    setSelectedProcessDetails: (state, action) => {
      state.selectedProcessDetails = action.payload;
    },
    setWsConnected: (state, action) => {
      state.wsConnected = action.payload;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    setFilterSeverity: (state, action) => {
      state.filterSeverity = action.payload;
    },
  }
});

export const {
  setProcesses,
  updateProcess,
  setAlerts,
  updateAlert,
  setEvents,
  addEvent,
  updateMitigation,
  setSelectedPid,
  setSelectedProcessDetails,
  setWsConnected,
  setSearchQuery,
  setFilterSeverity
} = telemetrySlice.actions;

export default telemetrySlice.reducer;
