import React, { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedPid, setSelectedProcessDetails } from '../store/telemetrySlice';
import { X, ShieldAlert, Cpu, HardDrive, User, Network, FileDown, ShieldCheck, Ban, Activity } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export default function ProcessDetailsDrawer({ onMitigate }) {
  const dispatch = useDispatch();
  
  // Selectors mapped to modular telemetry slice
  const selectedPid = useSelector((state) => state.telemetry.selectedPid);
  const details = useSelector((state) => state.telemetry.selectedProcessDetails);

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

      {/* DRAWER CONTENT */}
      {!isLoaded ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 font-mono text-xs gap-3">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>Ingesting Process Forensics...</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          
          {/* PROCESS CRITICAL INFO */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-gray-200 truncate">{details.process.name}</h2>
              <span className="text-[10px] text-gray-500 font-mono block mt-0.5 select-all">PID {details.process.pid} • {details.process.exe || '[Simulated Path]'}</span>
            </div>
            
            <div className="shrink-0 flex flex-col items-end">
              <span className={`text-xl font-black font-mono ${details.process.risk_score >= 70 ? 'text-rose-400' : details.process.risk_score >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {details.process.risk_score.toFixed(0)}%
              </span>
              <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider font-mono">Threat Risk</span>
            </div>
          </div>

          {/* RISK SPARKLINE */}
          <div className="bg-slate-950/40 border border-white/5 rounded-xl p-4 flex flex-col gap-2">
            <span className="text-[9px] font-bold uppercase text-gray-500 tracking-wider font-mono">Incident Score Vectors</span>
            <div className="h-16 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={riskHistoryData}>
                  <defs>
                    <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={details.process.risk_score >= 70 ? '#f43f5e' : '#6366f1'} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={details.process.risk_score >= 70 ? '#f43f5e' : '#6366f1'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ background: '#020617', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', fontFamily: 'monospace', fontSize: '9px' }}
                    labelStyle={{ color: '#64748b' }}
                  />
                  <Area type="monotone" dataKey="risk" stroke={details.process.risk_score >= 70 ? '#f43f5e' : '#6366f1'} strokeWidth={2} fillOpacity={1} fill="url(#riskGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SYSTEM PERFORMANCE METRICS */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-950/20 border border-white/5 rounded-xl flex items-center gap-3">
              <Cpu className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <span className="text-[9px] text-gray-500 font-bold uppercase block font-mono">Processor</span>
                <span className="text-xs font-bold font-mono text-gray-300">{details.process.cpu_percent}%</span>
              </div>
            </div>
            <div className="p-3 bg-slate-950/20 border border-white/5 rounded-xl flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-cyan-400 shrink-0" />
              <div>
                <span className="text-[9px] text-gray-500 font-bold uppercase block font-mono">Memory</span>
                <span className="text-xs font-bold font-mono text-gray-300">{details.process.memory_percent.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* DETAILS DIRECTORY */}
          <div className="flex flex-col gap-2 bg-slate-950/20 border border-white/5 rounded-xl p-4 font-mono text-xs">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-gray-500 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> User Owner</span>
              <span className="text-gray-300 font-semibold">{details.process.username || 'SYSTEM'}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 py-2">
              <span className="text-gray-500 flex items-center gap-1.5"><Network className="w-3.5 h-3.5" /> Sockets Opened</span>
              <span className="text-gray-300 font-semibold">{details.network_connections?.length || 0} Open</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-gray-500 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> IO Reads / Writes</span>
              <span className="text-gray-300 font-semibold">{details.process.read_count || 0} / {details.process.write_count || 0}</span>
            </div>
          </div>

          {/* RULES EXPLANATION */}
          {details.explanations && details.explanations.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider font-mono">Classifier Heuristic Hits</span>
              <div className="flex flex-col gap-2">
                {details.explanations.map((exp, idx) => (
                  <div key={idx} className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-lg text-xs leading-relaxed text-rose-300 font-mono">
                    ⚠️ {exp}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MITIGATION CONTAINMENT SECTION */}
          <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
            <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider font-mono">Containment Remediation</span>
            
            {details.process.status && details.process.status !== 'Normal' ? (
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-xs font-mono text-emerald-400 flex items-center gap-2">
                <ShieldCheck className="w-4.5 h-4.5" />
                <span>Process containerized: Status changed to <strong>{details.process.status}</strong>.</span>
              </div>
            ) : confirmAction ? (
              <div className="p-4 bg-slate-950 border border-white/5 rounded-xl flex flex-col gap-4">
                <p className="text-xs text-gray-300 font-mono leading-relaxed">
                  Are you sure you want to trigger <strong>{confirmAction.toUpperCase()}</strong> on PID {details.process.pid}? This command broadcasts via WebSockets directly to the target agent kernel daemon.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onMitigate(details.process.pid, confirmAction === 'kill' ? 'terminate' : confirmAction === 'quarantine' ? 'quarantine' : 'dismiss');
                      handleClose();
                    }}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider font-mono cursor-pointer transition-all"
                  >
                    Confirm Action
                  </button>
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-bold uppercase tracking-wider font-mono cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setConfirmAction('kill')}
                  className="py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/45 text-rose-400 rounded-lg text-[10px] font-extrabold uppercase tracking-wider cursor-pointer font-mono transition-all"
                >
                  Terminate
                </button>
                <button
                  onClick={() => setConfirmAction('quarantine')}
                  className="py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/45 text-amber-400 rounded-lg text-[10px] font-extrabold uppercase tracking-wider cursor-pointer font-mono transition-all"
                >
                  Quarantine
                </button>
                <button
                  onClick={() => setConfirmAction('ignore')}
                  className="py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/45 text-indigo-400 rounded-lg text-[10px] font-extrabold uppercase tracking-wider cursor-pointer font-mono transition-all"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* EXPORT ANOMALY COORDINATES */}
          <button
            onClick={handleExport}
            className="w-full flex items-center justify-center gap-1.5 py-3 mt-2 bg-slate-950 border border-white/5 hover:bg-slate-950/60 text-gray-400 hover:text-indigo-400 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer font-mono transition-all duration-300"
          >
            <FileDown className="w-4 h-4" /> Download Anomaly Coordinates
          </button>
          
        </div>
      )}
    </div>
  );
}
