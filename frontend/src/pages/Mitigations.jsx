import React from 'react';
import { useSelector } from 'react-redux';
import { ShieldAlert, ShieldCheck, Ban, History, Clock } from 'lucide-react';

export default function Mitigations() {
  const processes = useSelector((state) => state.hids.processes);
  const currentUser = useSelector((state) => state.hids.user);
  const groupsList = useSelector((state) => state.hids.groupsList);
  const usersList = useSelector((state) => state.hids.usersList);

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
                <td colSpan="6" className="p-12 text-center text-gray-600 font-mono">
                  <div className="flex flex-col items-center gap-2 justify-center">
                    <History className="w-6 h-6 text-white/5" />
                    <span>No process remediations logged in current session.</span>
                  </div>
                </td>
              </tr>
            ) : (
              mitigatedProcesses.map(p => {
                let badgeClass = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
                let icon = <Clock className="w-3.5 h-3.5" />;
                if (p.status === 'Terminated') {
                  badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                  icon = <Ban className="w-3.5 h-3.5 text-rose-400" />;
                } else if (p.status === 'Quarantined') {
                  badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                  icon = <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />;
                } else if (p.status === 'Ignored') {
                  badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  icon = <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
                }

                return (
                  <tr key={p.pid} className="border-b border-white/5 bg-slate-950/5">
                    <td className="p-3 font-bold font-mono text-gray-300">{p.pid}</td>
                    <td className="p-3">
                      <div className="flex flex-col max-w-[200px]">
                        <span className="font-semibold text-gray-200">{p.name}</span>
                        <span className="text-[9px] text-gray-500 font-mono truncate" title={p.exe}>{p.exe}</span>
                      </div>
                    </td>
                    <td className="p-3 font-mono font-semibold text-gray-300">
                      {p.status === 'Terminated' ? 'TASKKILL /F' : p.status === 'Quarantined' ? 'SUSPEND_PROCESS' : 'IGNORE_ALERTS'}
                    </td>
                    <td className="p-3">
                      <span className={`font-bold font-mono ${
                        p.risk_score >= 50 ? 'text-rose-400' : p.risk_score >= 20 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>{p.risk_score.toFixed(0)}%</span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[9px] font-bold font-mono ${badgeClass}`}>
                        {icon} {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-gray-400">
                      {new Date(p.last_seen || Date.now()).toLocaleString()}
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
