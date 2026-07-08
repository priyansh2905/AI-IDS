import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { 
  createGroup, exitGroup, joinRequestGroup, approveJoinRequest,
  inviteUser, acceptInvite, declineInvite, updateGroupStatus, searchPublicGroup
} from '../store/groupSlice';
import { Users, Plus, UserPlus, Check, X, LogOut, Clock, Globe, ShieldAlert, Search } from 'lucide-react';

function GroupInviteForm({ groupId }) {
  const dispatch = useDispatch();
  const [inviteKey, setInviteKey] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState('info');

  const handleInvite = async (e) => {
    e.preventDefault();
    setStatusMsg('');
    if (!inviteKey.trim()) return;

    try {
      await dispatch(inviteUser({ groupId, userKey: inviteKey.trim() })).unwrap();
      setStatusType('success');
      setStatusMsg('Invitation sent successfully!');
      setInviteKey('');
    } catch (err) {
      setStatusType('error');
      setStatusMsg(err || 'Failed to send invitation.');
    }
  };

  return (
    <form onSubmit={handleInvite} className="flex flex-col gap-1 border-t border-white/5 pt-2 mt-1">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="User key (key-username-xxxx)..."
          value={inviteKey}
          onChange={(e) => setInviteKey(e.target.value)}
          className="flex-1 px-2.5 py-1 bg-slate-950/60 border border-white/5 text-[10px] text-gray-300 rounded outline-none focus:border-indigo-500/50 transition-all font-mono"
        />
        <button
          type="submit"
          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold uppercase cursor-pointer transition-all font-mono shrink-0"
        >
          Invite
        </button>
      </div>
      {statusMsg && (
        <span className={`text-[8px] font-mono mt-0.5 ${statusType === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
          {statusMsg}
        </span>
      )}
    </form>
  );
}

export default function Groups() {
  const dispatch = useDispatch();
  
  const currentUser = useSelector((state) => state.user.user);
  const groupsList = useSelector((state) => state.group.groupsList);
  const usersList = useSelector((state) => state.user.usersList);
  
  const [newGroupName, setNewGroupName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Search public groups state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');

  // 1. Groups joined by the user
  const myGroups = groupsList.filter(g => g.members.includes(currentUser.id));
  
  // 2. Groups owned/created by the user (to manage join requests)
  const myOwnedGroups = groupsList.filter(g => g.creator_id === currentUser.id);

  // 3. Public groups available in directory (must be PUBLIC and user is not member)
  const availableGroups = groupsList.filter(g => !g.members.includes(currentUser.id) && g.status === 'public');

  // 4. Groups inviting the current user
  const invitedGroups = groupsList.filter(g => g.pending_invitations && g.pending_invitations.includes(currentUser.id));

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

  const handleSearchGroup = async (e) => {
    e.preventDefault();
    setSearchError('');
    setSearchResult(null);
    if (!searchQuery.trim()) return;

    try {
      const group = await dispatch(searchPublicGroup(searchQuery.trim())).unwrap();
      setSearchResult(group);
    } catch (err) {
      setSearchError(err || 'Group not found or is private.');
    }
  };

  const handleStatusToggle = (groupId, currentStatus) => {
    const nextStatus = currentStatus === 'public' ? 'private' : 'public';
    dispatch(updateGroupStatus({ groupId, status: nextStatus }));
  };

  const getUserDetails = (uid) => {
    const user = usersList.find(u => u.id === uid);
    return user ? { username: user.username, role: user.role } : { username: 'Unknown', role: 'unknown' };
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 min-w-0">
      
      {/* LEFT SIDEBAR: CREATING, SEARCHING & MY GROUPS (5/12 cols) */}
      <div className="lg:w-[420px] flex flex-col gap-6 shrink-0 min-h-0">
        
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

        {/* SEARCH PUBLIC GROUP BY KEY */}
        <section className="bg-slate-900/40 border border-white/5 rounded-xl p-5 shadow-lg flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-extrabold tracking-wider uppercase text-gray-200 font-mono">Search Public Group</h2>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">Search groups using unique grp-xxxxx keys</p>
          </div>

          <form onSubmit={handleSearchGroup} className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Group key (grp-name-xxxx)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-slate-950/40 border border-white/5 text-xs text-gray-200 rounded-lg outline-none focus:border-indigo-500/50 transition-all font-mono"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase cursor-pointer transition-all flex items-center gap-1 font-mono shrink-0"
              >
                <Search className="w-3.5 h-3.5" /> Search
              </button>
            </div>

            {searchError && (
              <span className="text-[10px] text-rose-400 font-mono">
                {searchError}
              </span>
            )}

            {searchResult && (
              <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg flex items-center justify-between text-xs font-mono mt-1">
                <div className="min-w-0">
                  <strong className="text-gray-200 block truncate">{searchResult.name}</strong>
                  <span className="text-[9px] text-gray-500">Key: {searchResult.group_key}</span>
                </div>
                <div className="shrink-0">
                  {searchResult.members.includes(currentUser.id) ? (
                    <span className="text-[10px] text-emerald-400">Member</span>
                  ) : searchResult.pending_requests.includes(currentUser.id) ? (
                    <span className="text-[10px] text-amber-400">Request Pending</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        dispatch(joinRequestGroup({ groupId: searchResult.id, userId: currentUser.id }));
                        setSearchResult(prev => ({ ...prev, pending_requests: [...prev.pending_requests, currentUser.id] }));
                      }}
                      className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Join
                    </button>
                  )}
                </div>
              </div>
            )}
          </form>
        </section>

        {/* MY GROUPS LIST */}
        <section className="bg-slate-900/40 border border-white/5 rounded-xl p-5 shadow-lg flex-1 flex flex-col gap-4 min-h-0">
          <div>
            <h2 className="text-sm font-extrabold tracking-wider uppercase text-gray-200 font-mono">My Group Connections</h2>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">Active groups you are authenticated to monitor</p>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[350px] flex flex-col gap-3 pr-1">
            {myGroups.length === 0 ? (
              <div className="h-28 flex flex-col items-center justify-center text-gray-600 font-mono text-[10px] gap-2 border border-dashed border-white/5 rounded-xl">
                <Users className="w-6 h-6 text-white/5" />
                <span>You belong to no monitoring groups.</span>
              </div>
            ) : (
              myGroups.map(g => {
                const owner = usersList.find(u => u.id === g.creator_id);
                const isOwner = g.creator_id === currentUser.id;
                return (
                  <div key={g.id} className="p-4 bg-slate-950/20 border border-white/5 rounded-xl flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <Link to={`/groups/${g.id}`} className="font-bold text-xs text-indigo-400 hover:text-indigo-300 hover:underline truncate font-mono block">
                          {g.name}
                        </Link>
                        <span className="text-[9px] text-gray-500 font-mono block mt-0.5">
                          Leader: {owner ? owner.username : 'Unknown'} • Members: {g.members.length}
                        </span>
                        <span className="text-[9px] text-indigo-400 font-mono block mt-0.5 select-all">
                          Key: {g.group_key}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOwner && (
                          <button
                            onClick={() => handleStatusToggle(g.id, g.status)}
                            className={`px-2 py-1 rounded text-[8px] font-bold font-mono border uppercase tracking-wider cursor-pointer transition-all ${
                              g.status === 'public' 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' 
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                            }`}
                            title="Toggle Privacy Status"
                          >
                            {g.status}
                          </button>
                        )}
                        <button
                          onClick={() => dispatch(exitGroup({ groupId: g.id, userId: currentUser.id }))}
                          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg cursor-pointer transition-all hover:scale-105 shrink-0"
                          title="Leave Group"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {isOwner && (
                      <GroupInviteForm groupId={g.id} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* RIGHT COLUMN: GROUP DIRECTORY & APPROVALS (7/12 cols) */}
      <div className="flex-1 flex flex-col gap-6 min-h-0">
        
        {/* RECEIVED GROUP INVITATIONS */}
        {invitedGroups.length > 0 && (
          <section className="bg-slate-900/40 border border-white/5 rounded-xl p-5 shadow-lg flex flex-col gap-4 animate-pulse">
            <div>
              <h2 className="text-sm font-extrabold tracking-wider uppercase text-amber-400 font-mono">Received Invitations</h2>
              <p className="text-[10px] text-gray-500 font-mono mt-0.5">Other monitoring groups have invited you to connect</p>
            </div>

            <div className="flex flex-col gap-3">
              {invitedGroups.map(g => {
                const owner = usersList.find(u => u.id === g.creator_id);
                return (
                  <div key={g.id} className="p-3.5 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-center justify-between gap-4 font-mono text-xs">
                    <div className="min-w-0">
                      <span className="text-gray-400">Invited to join </span>
                      <strong className="text-amber-400">{g.name}</strong>
                      <span className="text-gray-500"> (Leader: {owner ? owner.username : 'Unknown'})</span>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => dispatch(acceptInvite({ groupId: g.id, userId: currentUser.id }))}
                        className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/30 text-emerald-400 rounded cursor-pointer transition-all hover:scale-105"
                        title="Accept Invite"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => dispatch(declineInvite({ groupId: g.id, userId: currentUser.id }))}
                        className="p-1.5 bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/30 text-rose-400 rounded cursor-pointer transition-all hover:scale-105"
                        title="Decline Invite"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

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
