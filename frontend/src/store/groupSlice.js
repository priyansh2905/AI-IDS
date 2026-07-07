import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { deleteUser } from './userSlice';

export const fetchGroups = createAsyncThunk(
  'group/fetchGroups',
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch('/api/groups');
      const data = await res.json();
      if (!res.ok || data.status !== 'ok') {
        throw new Error(data.message || 'Failed to fetch groups');
      }
      return data.data; // Array of formatted groups
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const createGroup = createAsyncThunk(
  'group/createGroup',
  async ({ name, creatorId }, { rejectWithValue }) => {
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, creatorId })
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'ok') {
        throw new Error(data.message || 'Failed to create group');
      }
      return data.group;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const deleteGroup = createAsyncThunk(
  'group/deleteGroup',
  async (groupId, { rejectWithValue }) => {
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'ok') {
        throw new Error(data.message || 'Failed to dissolve group');
      }
      return groupId;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const exitGroup = createAsyncThunk(
  'group/exitGroup',
  async ({ groupId, userId }, { rejectWithValue }) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'ok') {
        throw new Error(data.message || 'Failed to exit group');
      }
      return data.group;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const joinRequestGroup = createAsyncThunk(
  'group/joinRequestGroup',
  async ({ groupId, userId }, { rejectWithValue }) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'ok') {
        throw new Error(data.message || 'Failed to request to join group');
      }
      return data.group;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const approveJoinRequest = createAsyncThunk(
  'group/approveJoinRequest',
  async ({ groupId, userId, approve }, { rejectWithValue }) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, approve })
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'ok') {
        throw new Error(data.message || 'Failed to resolve request');
      }
      return data.group;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const initialState = {
  groupsList: []
};

const groupSlice = createSlice({
  name: 'group',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchGroups.fulfilled, (state, action) => {
        state.groupsList = action.payload;
      })
      .addCase(createGroup.fulfilled, (state, action) => {
        state.groupsList.push(action.payload);
      })
      .addCase(deleteGroup.fulfilled, (state, action) => {
        state.groupsList = state.groupsList.filter(g => g.id !== action.payload);
      })
      .addCase(exitGroup.fulfilled, (state, action) => {
        const updated = action.payload;
        const index = state.groupsList.findIndex(g => g.id === updated.id);
        if (index !== -1) {
          state.groupsList[index] = updated;
        }
      })
      .addCase(joinRequestGroup.fulfilled, (state, action) => {
        const updated = action.payload;
        const index = state.groupsList.findIndex(g => g.id === updated.id);
        if (index !== -1) {
          state.groupsList[index] = updated;
        }
      })
      .addCase(approveJoinRequest.fulfilled, (state, action) => {
        const updated = action.payload;
        const index = state.groupsList.findIndex(g => g.id === updated.id);
        if (index !== -1) {
          state.groupsList[index] = updated;
        }
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        const userId = action.payload;
        state.groupsList = state.groupsList.map(grp => ({
          ...grp,
          members: grp.members.filter(uid => uid !== userId),
          pending_requests: grp.pending_requests.filter(uid => uid !== userId)
        }));
      });
  }
});

export default groupSlice.reducer;
