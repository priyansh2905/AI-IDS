import { createSlice } from '@reduxjs/toolkit';

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

const initialState = {
  user: cachedUser,
  token: cachedToken,
  usersList: initialUsersList
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
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
    deleteUser: (state, action) => {
      const userId = action.payload;
      state.usersList = state.usersList.filter(u => u.id !== userId);
    }
  }
});

export const { loginUser, registerUser, logoutUser, deleteUser } = userSlice.actions;
export default userSlice.reducer;
