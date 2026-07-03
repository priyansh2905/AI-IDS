import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { AlertTriangle, Clock, ShieldCheck, Ban, FileWarning, HelpCircle } from 'lucide-react';

export default function Alerts({ onMitigate }) {
  // Selectors mapped to respective store slices
  const alerts = useSelector((state) => state.telemetry.alerts);
  const currentUser = useSelector((state) => state.user.user);
  const groupsList = useSelector((state) => state.group.groupsList);
  const usersList = useSelector((state) => state.user.usersList);

  const [selectedAlertIdx, setSelectedAlertIdx] = useState(0);
  const [confirmMitigate, setConfirmMitigate] = useState(null); // { pid, action }
  const [isExecuting, setIsExecuting] = useState(false);

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

  const visibleAlerts = React.useMemo(() => {
    return alerts.filter(a => !allowedSensorIds || allowedSensorIds.includes(a.sensor_id || 'sensor-windows-testing'));
  }, [alerts, allowedSensorIds]);

  const activeAlerts = visibleAlerts.filter(a => a.status === 'Active');
  const selectedAlert = activeAlerts[selectedAlertIdx];

  const handleMitigateAction = async (pid, action) => {
    setIsExecuting(true);
    try {
      await onMitigate(pid, action);
      setConfirmMitigate(null);
      // Auto select first remaining alert if selected alert was mitigated
      if (selectedAlertIdx >= activeAlerts.length - 1) {
        setSelectedAlertIdx(Math.max(0, activeAlerts.length - 2));
      }
    } catch (err) {
      alert("Remediation execution failed.");
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 min-w-0">
      
      {/* LEFT COLUMN: ACTIVE ALERTS LIST (5/12 cols) */}
      <section className="lg:w-[450px] bg-slate-900/40 border border-white/5 rounded-xl p-5 flex flex-col gap-4 shadow-lg shrink-0">
        <div>
          <h2 className="text-base font-extrabold tracking-wider uppercase text-gray-200 font-mono">Active Incidents</h2>
          <p className="text-[10px] text-gray-500 font-mono mt-0.5">Flagged processes requiring administrator review</p>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[500px] flex flex-col gap-3">
          {activeAlerts.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-gray-600 font-mono text-xs gap-2">
              <ShieldCheck className="w-8 h-8 text-emerald-500/40" />
              <span>No active incidents detected.</span>
            </div>
          ) : (
            activeAlerts.map((a, idx) => {
              const isSelected = selectedAlert && selectedAlert.pid === a.pid;
              const severityColor = a.risk_score >= 70 ? 'border-rose-500/30 bg-rose-500/5 text-rose-300' : 'border-amber-500/30 bg-amber-500/5 text-amber-300';
              
              return (
                <div 
                  key={a.pid}
                  onClick={() => setSelectedAlertIdx(idx)}
                  className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer flex flex-col gap-2 ${
                    isSelected 
                      ? 'bg-slate-900 border-indigo-500/40 shadow-indigo-950/20' 
                      : 'bg-slate-950/25 border-white/5 hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-xs font-mono text-gray-200 select-all">PID {a.pid}</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase font-mono tracking-wider border ${severityColor}`}>
                      {a.risk_score >= 70 ? 'CRITICAL' : 'WARNING'} ({a.risk_score.toFixed(0)}%)
                    </span>
                  </div>
                  
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs text-gray-300 truncate font-mono">{a.process_name}</h3>
                    <span className="text-[10px] text-gray-500 block truncate font-mono">{a.process_name || '[Simulated Executable]'}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-mono mt-1 border-t border-white/5 pt-2">
                    <Clock className="w-3 h-3" />
                    <span>Detected {new Date(a.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* RIGHT COLUMN: FORENSIC DATA EXAMINER (7/12 cols) */}
      <section className="flex-1 bg-slate-900/40 border border-white/5 rounded-xl p-5 flex flex-col gap-5 shadow-lg min-h-[500px]">
        {!selectedAlert ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 font-mono text-xs gap-3">
            <ShieldCheck className="w-12 h-12 text-emerald-500/20 animate-pulse" />
            <span>Select an active incident from the list to begin autopsy.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-6 flex-1 overflow-y-auto pr-1">
            
            {/* Header Summary */}
            <div className="flex justify-between items-start gap-4">
              <div>
                <h2 className="text-base font-extrabold text-gray-200 font-mono">Incident Investigation: {selectedAlert.process_name}</h2>
                <span className="text-[10px] text-gray-500 font-mono mt-0.5 select-all">PID {selectedAlert.pid} • {selectedAlert.process_name || '[Simulated Executable]'}</span>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-2xl font-black font-mono text-rose-400">{selectedAlert.risk_score.toFixed(0)}%</span>
                <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider font-mono">Autopsy Risk Vector</span>
              </div>
            </div>

            {/* Explanation & Forensic Report box */}
            {((selectedAlert.explanations && selectedAlert.explanations.length > 0) || selectedAlert.explanation) && (
              <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl flex flex-col gap-3">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <FileWarning className="w-4 h-4" /> Classifier Indicators & Forensic Report
                </span>
                
                {selectedAlert.explanations && selectedAlert.explanations.length > 0 && (
                  <ul className="flex flex-col gap-1.5 text-xs text-rose-300 font-mono border-b border-rose-500/10 pb-3 mb-2">
                    {selectedAlert.explanations.map((exp, idx) => (
                      <li key={idx}>• {exp}</li>
                    ))}
                  </ul>
                )}
                
                {selectedAlert.explanation && (
                  <div className="text-xs text-rose-300 font-mono whitespace-pre-wrap leading-relaxed">
                    {selectedAlert.explanation}
                  </div>
                )}
              </div>
            )}

            {/* Detailed Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-950/20 border border-white/5 rounded-xl flex flex-col gap-1 font-mono text-xs">
                <span className="text-gray-500 uppercase text-[9px] font-bold tracking-wider">Detection Strategy</span>
                <span className="text-gray-300 font-bold">{selectedAlert.rule_hit || 'Random Forest Classifier'}</span>
              </div>
              <div className="p-4 bg-slate-950/20 border border-white/5 rounded-xl flex flex-col gap-1 font-mono text-xs">
                <span className="text-gray-500 uppercase text-[9px] font-bold tracking-wider">Detection Key Timestamp</span>
                <span className="text-gray-300 font-bold">{new Date(selectedAlert.timestamp).toLocaleString()}</span>
              </div>
            </div>

            {/* MITIGATION DRAWER CONTROLS */}
            <div className="flex flex-col gap-3.5 border-t border-white/5 pt-5 mt-auto">
              <div>
                <h3 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider font-mono flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-cyan-400" /> Containment Decision Action
                </h3>
                <p className="text-[10px] text-gray-500 font-mono mt-0.5">Approve and push containerization commands to the agent daemon</p>
              </div>

              {confirmMitigate ? (
                <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl flex flex-col gap-4 animate-fadeIn">
                  <p className="text-xs text-gray-300 font-mono leading-relaxed">
                    Executing <strong>{confirmMitigate.action.toUpperCase()}</strong> will broadcast immediate kernel hooks to isolate/terminate PID {confirmMitigate.pid}. This action is logged in audit records.
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={isExecuting}
                      onClick={() => handleMitigateAction(confirmMitigate.pid, confirmMitigate.action)}
                      className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider font-mono cursor-pointer transition-all"
                    >
                      {isExecuting ? "Executing..." : "Confirm Push"}
                    </button>
                    <button
                      onClick={() => setConfirmMitigate(null)}
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-bold uppercase tracking-wider font-mono cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setConfirmMitigate({ pid: selectedAlert.pid, action: 'terminate' })}
                    className="flex items-center justify-center gap-1.5 py-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-rose-400 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer font-mono transition-all hover:scale-[1.02]"
                  >
                    <Ban className="w-4 h-4 animate-pulse" /> Kill Process
                  </button>
                  <button
                    onClick={() => setConfirmMitigate({ pid: selectedAlert.pid, action: 'quarantine' })}
                    className="flex items-center justify-center gap-1.5 py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer font-mono transition-all hover:scale-[1.02]"
                  >
                    Quarantine Host
                  </button>
                  <button
                    onClick={() => setConfirmMitigate({ pid: selectedAlert.pid, action: 'dismiss' })}
                    className="flex items-center justify-center gap-1.5 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-400 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer font-mono transition-all hover:scale-[1.02]"
                  >
                    Dismiss Alert
                  </button>
                </div>
              )}
            </div>

          </div>
        )}
      </section>
    </div>
  );
}
