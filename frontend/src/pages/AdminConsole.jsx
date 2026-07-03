import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { deleteUser } from '../store/userSlice';
import { deleteGroup } from '../store/groupSlice';
import { Users, ShieldAlert, Trash2, Fingerprint, Activity, Radio } from 'lucide-react';

export default function AdminConsole() {
  const dispatch = useDispatch();

  // Selectors mapped to separate store slices
  const currentUser = useSelector((state) => state.user.user);
  const usersList = useSelector((state) => state.user.usersList);
  const groupsList = useSelector((state) => state.group.groupsList);
  const processes = useSelector((state) => state.telemetry.processes);

  // Statistics
  const totalUsers = usersList.length;
  const totalGroups = groupsList.length;
  const totalSensors = usersList.filter(u => u.role === 'type-2').length;

  const getOwnerName = (ownerId) => {
    const owner = usersList.find(u => u.id === ownerId);
    return owner ? owner.username : 'Unknown';
  };

  return (
    <div className="flex-1 flex flex-col gap-6 min-w-0">
      
      {/* ADMIN METRICS STATS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Users */}
        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-5 flex flex-col justify-between h-28 shadow-md">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Registered Console Users</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-extrabold text-gray-100 font-mono mt-1">{totalUsers}</div>
        </div>

        {/* Groups */}
        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-5 flex flex-col justify-between h-28 shadow-md">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Collaborative Cells</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-gray-100 font-mono mt-1">{totalGroups}</div>
        </div>

        {/* Sensors */}
        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-5 flex flex-col justify-between h-28 shadow-md">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Registered Host Sensors</span>
            <Radio className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono mt-1">{totalSensors}</div>
        </div>
      </section>

      {/* ADMIN WORKSPACE PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        
        {/* USERS DIRECTORY MANAGEMENT */}
        <section className="bg-slate-900/40 border border-white/5 rounded-xl p-5 flex flex-col gap-4 shadow-lg min-h-[420px]">
          <div>
            <h2 className="text-sm font-extrabold tracking-wider uppercase text-gray-200 font-mono flex items-center gap-1.5">
              <Fingerprint className="w-4.5 h-4.5 text-indigo-400" /> Manage Directory Users
            </h2>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">Revoke account authorizations and system access keys</p>
          </div>

          <div className="overflow-y-auto flex-1 max-h-[380px] border border-white/5 rounded-lg bg-slate-950/10">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-slate-950/30 text-gray-400 font-mono uppercase tracking-wider">
                  <th className="p-3">Username</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Sensor Mapping</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map(u => {
                  const isSelf = u.id === currentUser.id;
                  let badge = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
                  if (u.role === 'admin') badge = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                  else if (u.role === 'type-2') badge = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
                  
                  return (
                    <tr key={u.id} className="border-b border-white/5">
                      <td className="p-3 font-semibold text-gray-200 font-mono">
                        {u.username} {isSelf && <span className="text-[9px] text-gray-500">(you)</span>}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded border text-[8px] font-bold font-mono uppercase tracking-wider ${badge}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-gray-400 truncate max-w-[150px]" title={u.sensor_id}>
                        {u.sensor_id || 'N/A'}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          disabled={isSelf}
                          onClick={() => dispatch(deleteUser(u.id))}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/25 text-rose-400 rounded cursor-pointer transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed"
                          title={isSelf ? "Cannot delete yourself" : "Delete User"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECURITY GROUPS DIRECTORY */}
        <section className="bg-slate-900/40 border border-white/5 rounded-xl p-5 flex flex-col gap-4 shadow-lg min-h-[420px]">
          <div>
            <h2 className="text-sm font-extrabold tracking-wider uppercase text-gray-200 font-mono flex items-center gap-1.5">
              <Activity className="w-4.5 h-4.5 text-cyan-400" /> Manage Security Groups
            </h2>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">Audit, dissolve, and delete collaborative group cells</p>
          </div>

          <div className="overflow-y-auto flex-1 max-h-[380px] border border-white/5 rounded-lg bg-slate-950/10">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-slate-950/30 text-gray-400 font-mono uppercase tracking-wider">
                  <th className="p-3">Group Name</th>
                  <th className="p-3">Creator</th>
                  <th className="p-3 text-center">Members</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {groupsList.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-gray-600 font-mono">
                      No active groups on the network.
                    </td>
                  </tr>
                ) : (
                  groupsList.map(g => (
                    <tr key={g.id} className="border-b border-white/5">
                      <td className="p-3 font-semibold text-gray-200 font-mono">{g.name}</td>
                      <td className="p-3 font-mono text-gray-400">{getOwnerName(g.creator_id)}</td>
                      <td className="p-3 text-center font-mono text-gray-300">{g.members.length}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => dispatch(deleteGroup(g.id))}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/25 text-rose-400 rounded cursor-pointer transition-all hover:scale-105"
                          title="Delete Group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
