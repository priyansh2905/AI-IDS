import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createGroup, exitGroup, joinRequestGroup, approveJoinRequest } from '../store/groupSlice';
import { Users, Plus, UserPlus, Check, X, LogOut, Clock } from 'lucide-react';

export default function Groups() {
  const dispatch = useDispatch();
  
  // Selectors mapped to separate user and group slices
  const currentUser = useSelector((state) => state.user.user);
  const groupsList = useSelector((state) => state.group.groupsList);
  const usersList = useSelector((state) => state.user.usersList);
  
  const [newGroupName, setNewGroupName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Groups joined by the user
  const myGroups = groupsList.filter(g => g.members.includes(currentUser.id));
  
  // 2. Groups owned/created by the user (to manage join requests)
  const myOwnedGroups = groupsList.filter(g => g.creator_id === currentUser.id);

  // 3. Public groups available to request joining
  const availableGroups = groupsList.filter(g => !g.members.includes(currentUser.id));

  const handleCreateGroup = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!newGroupName.trim()) {
      setErrorMsg('Group name is required.');
      return;
    }
    dispatch(createGroup({ name: newGroupName.trim(), creatorId: currentUser.id }));
    setNewGroupName('');
  };

  // Helper to map userId to username and role
  const getUserDetails = (uid) => {
    const user = usersList.find(u => u.id === uid);
    return user ? { username: user.username, role: user.role } : { username: 'Unknown', role: 'unknown' };
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 min-w-0">
      
      {/* LEFT SIDEBAR: CREATING & MY GROUPS (5/12 cols) */}
      <div className="lg:w-[420px] flex flex-col gap-6 shrink-0">
        
        {/* CREATE GROUP FORM */}
        <section className="bg-slate-900/40 border border-white/5 rounded-xl p-5 shadow-lg flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-extrabold tracking-wider uppercase text-gray-200 font-mono">Create Security Group</h2>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">Define a collaborative cell for alert monitoring</p>
          </div>

          <form onSubmit={handleCreateGroup} className="flex flex-col gap-3">
            {errorMsg && (
              <div className="text-[10px] text-rose-400 font-mono">
                {errorMsg}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Group cell name..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-slate-950/40 border border-white/5 text-xs text-gray-200 rounded-lg outline-none focus:border-indigo-500/50 transition-all font-mono"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase cursor-pointer transition-all flex items-center gap-1 font-mono shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Create
              </button>
            </div>
          </form>
        </section>

        {/* MY GROUPS LIST */}
        <section className="bg-slate-900/40 border border-white/5 rounded-xl p-5 shadow-lg flex-1 flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-extrabold tracking-wider uppercase text-gray-200 font-mono">My Group Connections</h2>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">Active groups you are authenticated to monitor</p>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[380px] flex flex-col gap-3 pr-1">
            {myGroups.length === 0 ? (
              <div className="h-28 flex flex-col items-center justify-center text-gray-600 font-mono text-[10px] gap-2 border border-dashed border-white/5 rounded-xl">
                <Users className="w-6 h-6 text-white/5" />
                <span>You belong to no monitoring groups.</span>
              </div>
            ) : (
              myGroups.map(g => {
                const owner = usersList.find(u => u.id === g.creator_id);
                return (
                  <div key={g.id} className="p-4 bg-slate-950/20 border border-white/5 rounded-xl flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-bold text-xs text-gray-200 truncate font-mono">{g.name}</h3>
                      <span className="text-[9px] text-gray-500 font-mono block mt-0.5">
                        Leader: {owner ? owner.username : 'Unknown'} • Members: {g.members.length}
                      </span>
                    </div>
                    <button
                      onClick={() => dispatch(exitGroup({ groupId: g.id, userId: currentUser.id }))}
                      className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg cursor-pointer transition-all hover:scale-105 shrink-0"
                      title="Leave Group"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* RIGHT COLUMN: GROUP DIRECTORY & APPROVALS (7/12 cols) */}
      <div className="flex-1 flex flex-col gap-6 min-h-0">
        
        {/* GROUP APPROVALS (PENDING JOIN REQUESTS) */}
        <section className="bg-slate-900/40 border border-white/5 rounded-xl p-5 shadow-lg flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-extrabold tracking-wider uppercase text-gray-200 font-mono">Pending Join Approvals</h2>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">Awaiting leader authentication keys to link to your groups</p>
          </div>

          <div className="max-h-[220px] overflow-y-auto flex flex-col gap-3 pr-1">
            {myOwnedGroups.every(g => g.pending_requests.length === 0) ? (
              <div className="py-6 text-center text-gray-600 font-mono text-[10px]">
                No pending requests requiring approval.
              </div>
            ) : (
              myOwnedGroups.map(g => (
                g.pending_requests.map(uid => {
                  const applicant = getUserDetails(uid);
                  return (
                    <div key={`${g.id}-${uid}`} className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg flex items-center justify-between gap-4 font-mono text-xs">
                      <div className="min-w-0">
                        <span className="text-gray-400">Request from </span>
                        <strong className="text-indigo-400">{applicant.username}</strong>
                        <span className="text-gray-500"> ({applicant.role === 'type-2' ? 'Sensor Host' : 'Monitor'})</span>
                        <span className="text-gray-400"> to join group </span>
                        <strong className="text-gray-200">{g.name}</strong>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => dispatch(approveJoinRequest({ groupId: g.id, userId: uid, approve: true }))}
                          className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/30 text-emerald-400 rounded cursor-pointer transition-all hover:scale-105"
                          title="Approve Request"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => dispatch(approveJoinRequest({ groupId: g.id, userId: uid, approve: false }))}
                          className="p-1.5 bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/30 text-rose-400 rounded cursor-pointer transition-all hover:scale-105"
                          title="Reject Request"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ))
            )}
          </div>
        </section>

        {/* PUBLIC GROUP DIRECTORY */}
        <section className="bg-slate-900/40 border border-white/5 rounded-xl p-5 shadow-lg flex-1 flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-extrabold tracking-wider uppercase text-gray-200 font-mono">Global Group Directory</h2>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">Browse and request connections to collaborative security cells</p>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[360px] border border-white/5 rounded-lg bg-slate-950/10">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-slate-950/30 text-gray-400 font-mono uppercase tracking-wider">
                  <th className="p-3">Group Name</th>
                  <th className="p-3">Leader</th>
                  <th className="p-3 text-center">Members</th>
                  <th className="p-3 text-right">Access Link</th>
                </tr>
              </thead>
              <tbody>
                {availableGroups.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-gray-600 font-mono">
                      No other groups available in directory.
                    </td>
                  </tr>
                ) : (
                  availableGroups.map(g => {
                    const owner = usersList.find(u => u.id === g.creator_id);
                    const hasRequested = g.pending_requests.includes(currentUser.id);
                    
                    return (
                      <tr key={g.id} className="border-b border-white/5">
                        <td className="p-3 font-semibold text-gray-200 font-mono">{g.name}</td>
                        <td className="p-3 font-mono text-gray-400">{owner ? owner.username : 'Unknown'}</td>
                        <td className="p-3 text-center font-mono text-gray-300">{g.members.length}</td>
                        <td className="p-3 text-right">
                          {hasRequested ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 font-mono">
                              <Clock className="w-3 h-3" /> Pending Leader approval
                            </span>
                          ) : (
                            <button
                              onClick={() => dispatch(joinRequestGroup({ groupId: g.id, userId: currentUser.id }))}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/25 text-indigo-400 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all hover:scale-[1.02]"
                            >
                              <UserPlus className="w-3 h-3" /> Request Connection
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
