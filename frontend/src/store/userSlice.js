import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchUsers = createAsyncThunk(
  'user/fetchUsers',
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (!res.ok || data.status !== 'ok') {
        throw new Error(data.message || 'Failed to fetch users');
      }
      return data.data; // Array of formatted users
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const loginUser = createAsyncThunk(
  'user/loginUser',
  async ({ username, password, role, sensorId }, { rejectWithValue }) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role, sensorId })
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'ok') {
        throw new Error(data.message || 'Failed to login');
      }
      return data; // { token, user }
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const registerUser = createAsyncThunk(
  'user/registerUser',
  async ({ username, password, role, sensorId }, { rejectWithValue }) => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role, sensor_id: sensorId })
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'ok') {
        throw new Error(data.message || 'Failed to register');
      }
      return data; // { token, user }
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const deleteUser = createAsyncThunk(
  'user/deleteUser',
  async (userId, { rejectWithValue }) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'ok') {
        throw new Error(data.message || 'Failed to delete user');
      }
      return userId;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'user/updateUserProfile',
  async ({ email }, { rejectWithValue }) => {
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'ok') {
        throw new Error(data.message || 'Failed to update profile');
      }
      return data.user; // updated user data
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const cachedUser = (() => {
  try {
    const cached = localStorage.getItem('hids_user');
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    return null;
  }
})();
const cachedToken = localStorage.getItem('hids_token') || null;

const initialState = {
  user: cachedUser,
  token: cachedToken,
  usersList: [],
  status: 'idle',
  error: null
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    logoutUser: (state) => {
      state.user = null;
      state.token = null;
      localStorage.removeItem('hids_user');
      localStorage.removeItem('hids_token');
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.usersList = action.payload;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.token = action.payload.token;
        localStorage.setItem('hids_user', JSON.stringify(action.payload.user));
        localStorage.setItem('hids_token', action.payload.token);
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        const { user, token } = action.payload;
        state.usersList.push(user);
        // Always auto-login the newly registered user with the real JWT token
        state.user = user;
        state.token = token;
        localStorage.setItem('hids_user', JSON.stringify(user));
        localStorage.setItem('hids_token', token);
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.usersList = state.usersList.filter(u => u.id !== action.payload);
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.user = action.payload;
        localStorage.setItem('hids_user', JSON.stringify(action.payload));
        const idx = state.usersList.findIndex(u => u.id === action.payload.id);
        if (idx !== -1) {
          state.usersList[idx] = action.payload;
        }
      });
  }
});

export const { logoutUser } = userSlice.actions;
export default userSlice.reducer;
