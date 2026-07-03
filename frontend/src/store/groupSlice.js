import { createSlice } from '@reduxjs/toolkit';
import { deleteUser } from './userSlice';

const initialState = {
  groupsList: [
    { id: 'grp-1', name: 'Alpha Response Force', creator_id: 'usr-admin', members: ['usr-admin', 'usr-type1', 'usr-type2'], pending_requests: [] }
  ]
};

const groupSlice = createSlice({
  name: 'group',
  initialState,
  reducers: {
    createGroup: (state, action) => {
      const { name, creatorId } = action.payload;
      const newGroup = {
        id: 'grp-' + Date.now(),
        name,
        creator_id: creatorId,
        members: [creatorId],
        pending_requests: []
      };
      state.groupsList.push(newGroup);
    },
    deleteGroup: (state, action) => {
      const groupId = action.payload;
      state.groupsList = state.groupsList.filter(g => g.id !== groupId);
    },
    exitGroup: (state, action) => {
      const { groupId, userId } = action.payload;
      const grp = state.groupsList.find(g => g.id === groupId);
      if (grp) {
        grp.members = grp.members.filter(uid => uid !== userId);
      }
    },
    joinRequestGroup: (state, action) => {
      const { groupId, userId } = action.payload;
      const grp = state.groupsList.find(g => g.id === groupId);
      if (grp && !grp.pending_requests.includes(userId)) {
        grp.pending_requests.push(userId);
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
    }
  },
  extraReducers: (builder) => {
    // Automatically clean up user from group lists on account deletion
    builder.addCase(deleteUser, (state, action) => {
      const userId = action.payload;
      state.groupsList = state.groupsList.map(grp => ({
        ...grp,
        members: grp.members.filter(uid => uid !== userId),
        pending_requests: grp.pending_requests.filter(uid => uid !== userId)
      }));
    });
  }
});

export const { createGroup, deleteGroup, exitGroup, joinRequestGroup, approveJoinRequest } = groupSlice.actions;
export default groupSlice.reducer;
