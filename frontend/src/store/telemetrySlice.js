import { createSlice } from '@reduxjs/toolkit';

const normalizeAlert = (alert) => {
  if (!alert) return alert;
  const normalized = { ...alert };
  
  // 1. Map process_name to name and exe if they are missing
  if (!normalized.name) normalized.name = normalized.process_name || `PID ${normalized.pid}`;
  if (!normalized.exe) normalized.exe = normalized.process_name || `PID ${normalized.pid}`;
  
  // 2. Map status based on mitigation_status if status is missing or default Active
  if (!normalized.status || normalized.status === 'Active') {
    if (normalized.mitigation_status === 'terminated') {
      normalized.status = 'terminate';
    } else if (normalized.mitigation_status === 'quarantined') {
      normalized.status = 'quarantine';
    } else if (normalized.mitigation_status === 'dismissed') {
      normalized.status = 'dismiss';
    } else if (normalized.mitigation_status === 'pending') {
      normalized.status = 'pending';
    } else {
      normalized.status = 'Active';
    }
  }

  // 3. Map rule_hits / rule_triggers to rule_hit
  const triggers = normalized.rule_triggers || normalized.rule_hits || [];
  normalized.rule_hit = normalized.rule_hit || (triggers.length > 0 ? triggers[0] : 'Random Forest Classifier');

  // 4. Map explanation to explanations (array of lines or parsed points)
  if (!normalized.explanations) {
    if (normalized.explanation) {
      // Extract bullet points from the explanation
      normalized.explanations = normalized.explanation
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('- '))
        .map(line => line.substring(2).trim());
    } else {
      normalized.explanations = [];
    }
  }
  
  return normalized;
};

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
      state.alerts = (Array.isArray(action.payload) ? action.payload : []).map(normalizeAlert);
    },
    updateAlert: (state, action) => {
      const normalized = normalizeAlert(action.payload);
      const index = state.alerts.findIndex(a => a.pid === normalized.pid);
      if (index !== -1) {
        state.alerts[index] = normalized;
      } else {
        state.alerts.unshift(normalized);
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
      const mappedProcStatus = status === 'terminate' ? 'Terminated' : 
                               status === 'quarantine' ? 'Quarantined' : 
                               status === 'dismiss' ? 'Ignored' : status;
                               
      state.processes = state.processes.map(p =>
        p.pid === pid ? { ...p, status: mappedProcStatus } : p
      );
      state.alerts = state.alerts.map(a =>
        a.pid === pid ? { 
          ...a, 
          status, 
          mitigation_status: status === 'terminate' ? 'terminated' : status === 'quarantine' ? 'quarantined' : status === 'dismiss' ? 'dismissed' : 'pending' 
        } : a
      );
      if (state.selectedProcessDetails && state.selectedProcessDetails.process.pid === pid) {
        state.selectedProcessDetails.process.status = mappedProcStatus;
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
