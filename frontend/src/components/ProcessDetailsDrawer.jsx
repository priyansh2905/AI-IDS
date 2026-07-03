import React, { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedPid, setSelectedProcessDetails } from '../store/hidsSlice';
import { X, ShieldAlert, Cpu, HardDrive, User, Network, FileDown, ShieldCheck, Ban, Activity } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export default function ProcessDetailsDrawer({ onMitigate }) {
  const dispatch = useDispatch();
  const selectedPid = useSelector((state) => state.hids.selectedPid);
  const details = useSelector((state) => state.hids.selectedProcessDetails);

  const [confirmAction, setConfirmAction] = useState(null); // 'kill' | 'quarantine' | 'ignore' | null

  if (!selectedPid) return null;

  const handleClose = () => {
    dispatch(setSelectedPid(null));
    dispatch(setSelectedProcessDetails(null));
    setConfirmAction(null);
  };

  const isLoaded = details && details.process && details.process.pid === selectedPid;

  // Generate sparkline risk trend coordinates based on current risk
  const riskHistoryData = useMemo(() => {
    if (!isLoaded) return [];
    const currentRisk = details.process.risk_score;
    return [
      { step: 'T-4', risk: Math.max(0, currentRisk - 25) },
      { step: 'T-3', risk: Math.max(0, currentRisk - 15) },
      { step: 'T-2', risk: Math.min(100, currentRisk + 10) },
      { step: 'T-1', risk: Math.max(0, currentRisk - 5) },
      { step: 'T-0', risk: currentRisk },
    ];
  }, [details, isLoaded]);

  const handleExport = () => {
    if (!isLoaded) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(details, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `AI_HIDS_Forensics_PID_${details.process.pid}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[450px] bg-slate-900/95 border-l border-white/5 shadow-2xl backdrop-blur-xl flex flex-col z-50 transition-all duration-300">
      {/* DRAWER HEADER */}
      <div className="flex justify-between items-center p-4 border-b border-white/5 bg-slate-950/30">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-sm text-gray-200 uppercase tracking-wider font-mono">Process Forensics</span>
        </div>
        <button 
          onClick={handleClose} 
          className="p-1 rounded-lg text-gray-400 hover:bg-white/5 hover:text-gray-200 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {!isLoaded ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 font-mono text-sm gap-2">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>Polling telemetry logs...</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          {/* RISK CARD */}
          <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg text-gray-100 truncate max-w-[240px]" title={details.process.name}>
                {details.process.name}
              </h3>
              <span className="text-xs text-gray-400 font-mono">PID {details.process.pid}</span>
            </div>
            
            <div className="text-right">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider ${
                details.process.classification === 'Malicious' 
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {details.process.classification.toUpperCase()} ({details.process.risk_score}%)
              </span>
            </div>
          </div>

          {/* RISK TIMELINE CHART */}
          <div className="bg-slate-950/20 border border-white/5 rounded-xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 font-mono">Risk Anomaly Timeline</h4>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={riskHistoryData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <XAxis dataKey="step" stroke="#4b5563" fontSize={10} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="#4b5563" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '8px' }}
                    labelClassName="font-mono text-xs text-gray-400"
                  />
                  <Area type="monotone" dataKey="risk" stroke="#6366f1" fill="rgba(99, 102, 241, 0.15)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PROCESS PROPERTIES */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950/20 border border-white/5 rounded-lg p-3">
              <span className="text-[10px] uppercase font-bold text-gray-500 block font-mono">CPU Usage</span>
              <span className="text-sm font-semibold text-gray-300 flex items-center gap-1.5 mt-1">
                <Cpu className="w-4 h-4 text-cyan-400" /> {details.process.cpu_percent}%
              </span>
            </div>
            
            <div className="bg-slate-950/20 border border-white/5 rounded-lg p-3">
              <span className="text-[10px] uppercase font-bold text-gray-500 block font-mono">Memory Allocation</span>
              <span className="text-sm font-semibold text-gray-300 flex items-center gap-1.5 mt-1">
                <HardDrive className="w-4 h-4 text-purple-400" /> {details.process.memory_percent.toFixed(1)}%
              </span>
            </div>

            <div className="bg-slate-950/20 border border-white/5 rounded-lg p-3 col-span-2">
              <span className="text-[10px] uppercase font-bold text-gray-500 block font-mono">Parent Context</span>
              <span className="text-sm font-semibold text-gray-300 flex items-center gap-1.5 mt-1 truncate">
                <Activity className="w-4 h-4 text-indigo-400" /> {details.process.parent_name} (PPID {details.process.parent_pid})
              </span>
            </div>

            <div className="bg-slate-950/20 border border-white/5 rounded-lg p-3 col-span-2">
              <span className="text-[10px] uppercase font-bold text-gray-500 block font-mono">Active Executable</span>
              <span className="text-xs font-mono text-gray-400 mt-1 block truncate" title={details.process.exe}>
                {details.process.exe}
              </span>
            </div>

            <div className="bg-slate-950/20 border border-white/5 rounded-lg p-3">
              <span className="text-[10px] uppercase font-bold text-gray-500 block font-mono">User Environment</span>
              <span className="text-sm font-semibold text-gray-300 flex items-center gap-1.5 mt-1">
                <User className="w-4 h-4 text-emerald-400" /> {details.process.username}
              </span>
            </div>

            <div className="bg-slate-950/20 border border-white/5 rounded-lg p-3">
              <span className="text-[10px] uppercase font-bold text-gray-500 block font-mono">Execution Status</span>
              <span className="text-sm font-semibold text-gray-300 flex items-center gap-1.5 mt-1">
                <span className={`w-2 h-2 rounded-full ${
                  details.process.status === 'Running' ? 'bg-emerald-500' : 'bg-rose-500'
                }`} />
                {details.process.status}
              </span>
            </div>
          </div>

          {/* ACTIVE REMEDIATION ACTIONS */}
          <div className="bg-slate-950/20 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">Security Remediation</h4>
            
            {confirmAction ? (
              <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-lg">
                <p className="text-xs text-rose-200 mb-2">Are you sure you want to run <strong>{confirmAction.toUpperCase()}</strong> on PID {details.process.pid}?</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      onMitigate(details.process.pid, confirmAction);
                      setConfirmAction(null);
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-xs font-bold uppercase rounded cursor-pointer transition-all"
                  >
                    Confirm
                  </button>
                  <button 
                    onClick={() => setConfirmAction(null)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase rounded cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  disabled={details.process.status === 'Terminated'}
                  onClick={() => setConfirmAction('kill')}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-30 disabled:pointer-events-none text-rose-400 border border-rose-500/20 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
                >
                  <Ban className="w-3.5 h-3.5" /> Terminate
                </button>
                
                <button
                  disabled={details.process.status === 'Quarantined' || details.process.status === 'Terminated'}
                  onClick={() => setConfirmAction('quarantine')}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-30 disabled:pointer-events-none text-amber-400 border border-amber-500/20 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Quarantine
                </button>

                <button
                  onClick={() => setConfirmAction('ignore')}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/20 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
                >
                  Ignore
                </button>
              </div>
            )}
          </div>

          {/* TELEMETRY EVENTS HISTORY */}
          <div className="flex-1 flex flex-col min-h-[220px]">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">Process Event Stream</h4>
              <button 
                onClick={handleExport}
                className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 font-mono"
              >
                <FileDown className="w-3.5 h-3.5" /> EXPORT FORENSICS
              </button>
            </div>
            
            <div className="flex-1 bg-slate-950/40 border border-white/5 rounded-xl p-3 overflow-y-auto max-h-[300px] flex flex-col gap-2">
              {!details.events || details.events.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-600 font-mono">
                  No telemetry logged for this process
                </div>
              ) : (
                details.events.map((e, idx) => (
                  <div key={idx} className="text-xs border-b border-white/5 pb-2 last:border-b-0 font-mono">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                      <span>{e.event_type.toUpperCase()} - {e.action.toUpperCase()}</span>
                      <span>{new Date(e.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-gray-300 truncate" title={e.target_path}>
                      <strong>Target:</strong> {e.target_path || 'None'}
                    </p>
                    {e.details && (
                      <p className="text-gray-500 mt-0.5 truncate" title={e.details}>
                        {e.details}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
