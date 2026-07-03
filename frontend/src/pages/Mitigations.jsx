import React from 'react';
import { useSelector } from 'react-redux';
import { ShieldAlert, ShieldCheck, Ban, History, Clock } from 'lucide-react';

export default function Mitigations() {
  // Selectors mapped to separate store slices
  const processes = useSelector((state) => state.telemetry.processes);
  const currentUser = useSelector((state) => state.user.user);
  const groupsList = useSelector((state) => state.group.groupsList);
  const usersList = useSelector((state) => state.user.usersList);

  // Group-based sensor filtering
  const allowedSensorIds = React.useMemo(() => {
    if (!currentUser || currentUser.role === 'admin') return null;
    
    const myGroupIds = groupsList.filter(g => g.members.includes(currentUser.id)).map(g => g.id);
    const memberIds = new Set();
    groupsList.forEach(g => {
      if (myGroupIds.includes(g.id)) {
        g.members.forEach(uid => memberIds.add(uid));
      }
    });
    
    if (currentUser.role === 'type-2') {
      memberIds.add(currentUser.id);
    }
    
    const sensorIds = new Set();
    usersList.forEach(u => {
      if (memberIds.has(u.id) && u.role === 'type-2' && u.sensor_id) {
        sensorIds.add(u.sensor_id);
      }
    });
    return Array.from(sensorIds);
  }, [currentUser, groupsList, usersList]);

  const visibleProcesses = React.useMemo(() => {
    return processes.filter(p => !allowedSensorIds || allowedSensorIds.includes(p.sensor_id || 'sensor-windows-testing'));
  }, [processes, allowedSensorIds]);

  // Filter processes that are Quarantined, Terminated, or Ignored
  const mitigatedProcesses = visibleProcesses.filter(p => 
    p.status === 'Quarantined' || p.status === 'Terminated' || p.status === 'Ignored'
  );

  return (
    <div className="flex-1 bg-slate-900/40 border border-white/5 rounded-xl p-5 flex flex-col gap-4 shadow-lg min-h-[500px]">
      <div>
        <h2 className="text-base font-extrabold tracking-wider uppercase text-gray-200 font-mono">Mitigation Audit Logs</h2>
        <p className="text-[10px] text-gray-500 font-mono mt-0.5">Historical log of active and historical containerizations and remediations</p>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[500px] border border-white/5 rounded-lg bg-slate-950/10">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/5 bg-slate-950/30 text-gray-400 font-mono uppercase tracking-wider">
              <th className="p-3">PID</th>
              <th className="p-3">Process Name</th>
              <th className="p-3">Mitigation Action</th>
              <th className="p-3">Peak Risk</th>
              <th className="p-3">Remediation Status</th>
              <th className="p-3">Last Active Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {mitigatedProcesses.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-8 text-center text-gray-600 font-mono">
                  No historical mitigation logs available.
                </td>
              </tr>
            ) : (
              mitigatedProcesses.map((p) => {
                let badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                let icon = <Ban className="w-3.5 h-3.5" />;
                
                if (p.status === 'Quarantined') {
                  badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                  icon = <ShieldAlert className="w-3.5 h-3.5" />;
                } else if (p.status === 'Ignored') {
                  badgeColor = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
                  icon = <ShieldCheck className="w-3.5 h-3.5" />;
                }
                
                return (
                  <tr key={p.pid} className="border-b border-white/5 font-mono text-xs">
                    <td className="p-3 text-gray-300 font-bold select-all">{p.pid}</td>
                    <td className="p-3 text-gray-200">{p.name}</td>
                    <td className="p-3 uppercase font-bold tracking-wider">{p.status === 'Terminated' ? 'SIGKILL' : p.status === 'Quarantined' ? 'ISOLATE' : 'DISMISS'}</td>
                    <td className="p-3 text-rose-400 font-bold">{p.risk_score.toFixed(0)}%</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[9px] font-bold uppercase tracking-wider ${badgeColor}`}>
                        {icon} {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-gray-400">
                      <div className="flex items-center gap-1">
                        <History className="w-3 h-3 text-gray-500" />
                        <span>{p.timestamp ? new Date(p.timestamp).toLocaleString() : new Date().toLocaleString()}</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
