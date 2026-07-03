import { createSlice } from '@reduxjs/toolkit';

// Parse initial cache values safely
const cachedUser = (() => {
  try {
    const cached = localStorage.getItem('hids_user');
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    return null;
  }
})();
const cachedToken = localStorage.getItem('hids_token') || null;

const initialUsersList = [
  { id: 'usr-admin', username: 'admin', role: 'admin' },
  { id: 'usr-type1', username: 'type1', role: 'type-1' },
  { id: 'usr-type2', username: 'type2', role: 'type-2', sensor_id: 'sensor-windows-testing' }
];

const initialGroupsList = [
  { id: 'grp-1', name: 'Alpha Response Force', creator_id: 'usr-admin', members: ['usr-admin', 'usr-type1', 'usr-type2'], pending_requests: [] }
];

const initialState = {
  processes: [],
  alerts: [],
  events: [],
  selectedPid: null,
  selectedProcessDetails: null,
  wsConnected: false,
  searchQuery: '',
  filterSeverity: 'ALL',
  
  // Auth and user role states
  user: cachedUser,
  token: cachedToken,
  usersList: initialUsersList,
  groupsList: initialGroupsList
};

const hidsSlice = createSlice({
  name: 'hids',
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

    loginUser: (state, action) => {
      const { username, role, sensorId } = action.payload;
      const found = state.usersList.find(u => u.username.toLowerCase() === username.toLowerCase() && u.role === role);
      if (found) {
        if (role === 'type-2' && found.sensor_id !== sensorId) {
          throw new Error("Invalid Sensor ID Key.");
        }
        state.user = found;
        state.token = `mock-jwt-token-head.${btoa(JSON.stringify(found))}.signature`;
        localStorage.setItem('hids_user', JSON.stringify(found));
        localStorage.setItem('hids_token', state.token);
      } else {
        throw new Error("Invalid username or selected access role.");
      }
    },
    registerUser: (state, action) => {
      const { username, role, sensorId } = action.payload;
      const exists = state.usersList.some(u => u.username.toLowerCase() === username.toLowerCase());
      if (exists) {
        throw new Error("Username is already taken.");
      }
      
      const newUser = {
        id: 'usr-' + Date.now(),
        username,
        role,
        ...(role === 'type-2' && { sensor_id: sensorId })
      };
      
      state.usersList.push(newUser);
      
      // Auto login for non-host roles (type-1, admin)
      if (role !== 'type-2') {
        state.user = newUser;
        state.token = `mock-jwt-token-head.${btoa(JSON.stringify(newUser))}.signature`;
        localStorage.setItem('hids_user', JSON.stringify(newUser));
        localStorage.setItem('hids_token', state.token);
      }
    },
    logoutUser: (state) => {
      state.user = null;
      state.token = null;
      localStorage.removeItem('hids_user');
      localStorage.removeItem('hids_token');
    },

    // --- Dynamic Group Collaborative Reducers ---
    createGroup: (state, action) => {
      const { name } = action.payload;
      const newGroup = {
        id: 'grp-' + Date.now(),
        name,
        creator_id: state.user.id,
        members: [state.user.id],
        pending_requests: []
      };
      state.groupsList.push(newGroup);
    },
    deleteGroup: (state, action) => {
      const groupId = action.payload;
      state.groupsList = state.groupsList.filter(g => g.id !== groupId);
    },
    exitGroup: (state, action) => {
      const groupId = action.payload;
      const grp = state.groupsList.find(g => g.id === groupId);
      if (grp) {
        grp.members = grp.members.filter(uid => uid !== state.user.id);
      }
    },
    joinRequestGroup: (state, action) => {
      const groupId = action.payload;
      const grp = state.groupsList.find(g => g.id === groupId);
      if (grp && !grp.pending_requests.includes(state.user.id)) {
        grp.pending_requests.push(state.user.id);
      }
    },
    approveJoinRequest: (state, action) => {
      const { groupId, userId, approve } = action.payload;
      const grp = state.groupsList.find(g => g.id === groupId);
      if (grp) {
        grp.pending_requests = grp.pending_requests.filter(uid => uid !== userId);
        if (approve && !grp.members.includes(userId)) {
          grp.members.push(userId);
        }
      }
    },

    // --- Admin User Management Reducers ---
    deleteUser: (state, action) => {
      const userId = action.payload;
      state.usersList = state.usersList.filter(u => u.id !== userId);
      // Clean up user from group memberships and request cues
      state.groupsList = state.groupsList.map(grp => ({
        ...grp,
        members: grp.members.filter(uid => uid !== userId),
        pending_requests: grp.pending_requests.filter(uid => uid !== userId)
      }));
    }
  },
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
  setFilterSeverity,
  
  // Auth & Groups
  loginUser,
  registerUser,
  logoutUser,
  createGroup,
  deleteGroup,
  exitGroup,
  joinRequestGroup,
  approveJoinRequest,
  deleteUser
} = hidsSlice.actions;

export default hidsSlice.reducer;
