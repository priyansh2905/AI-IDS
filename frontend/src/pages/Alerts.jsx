import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { AlertTriangle, Clock, ShieldCheck, Ban, FileWarning, HelpCircle } from 'lucide-react';

export default function Alerts({ onMitigate }) {
  const alerts = useSelector((state) => state.hids.alerts);
  const [selectedAlertIdx, setSelectedAlertIdx] = useState(0);
  const [confirmMitigate, setConfirmMitigate] = useState(null); // { pid, action }
  const [isExecuting, setIsExecuting] = useState(false);

  const activeAlerts = alerts.filter(a => a.status === 'Active');
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
            activeAlerts.map((a, idx) => (
              <div
                key={a.pid}
                onClick={() => setSelectedAlertIdx(idx)}
                className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col gap-2 relative overflow-hidden ${
                  selectedAlertIdx === idx
                    ? 'bg-rose-500/10 border-rose-500/35 shadow-md shadow-rose-950/20'
                    : 'bg-slate-950/25 border-white/5 hover:bg-slate-950/40 hover:border-white/10'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-200 font-mono truncate max-w-[200px]" title={a.process_name}>
                      {a.process_name}
                    </h3>
                    <span className="text-[10px] text-gray-500 font-mono">PID {a.pid}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-bold font-mono">
                    RISK {a.risk_score.toFixed(0)}%
                  </span>
                </div>
                
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-mono mt-1">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(a.timestamp).toLocaleString()}
                </div>

                <div className="flex flex-wrap gap-1 mt-1">
                  {a.rule_triggers && a.rule_triggers.map((rule) => (
                    <span key={rule} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[8px] font-bold font-mono text-gray-400">
                      {rule}
                    </span>
                  ))}
                </div>

                <div className="w-1.5 h-full absolute left-0 top-0 bg-rose-500" />
              </div>
            ))
          )}
        </div>
      </section>

      {/* RIGHT COLUMN: DETAILED INVESTIGATION CONSOLE (7/12 cols) */}
      <section className="flex-1 bg-slate-900/40 border border-white/5 rounded-xl p-5 flex flex-col gap-4 shadow-lg min-h-[500px]">
        <div>
          <h2 className="text-base font-extrabold tracking-wider uppercase text-gray-200 font-mono">Incident Investigation Console</h2>
          <p className="text-[10px] text-gray-500 font-mono mt-0.5">Heuristic rule alerts and machine learning explanations</p>
        </div>

        {!selectedAlert ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600 font-mono text-xs gap-2">
            <HelpCircle className="w-10 h-10 text-white/5" />
            <span>Select an incident from the left sidebar to begin analysis.</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-5 overflow-y-auto">
            {/* INCIDENT HIGHLIGHTS */}
            <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-[9px] uppercase font-bold text-gray-500 block font-mono">Classification</span>
                <span className="text-sm font-extrabold text-rose-400 mt-1 font-mono">{selectedAlert.classification.toUpperCase()}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-gray-500 block font-mono">Model Confidence</span>
                <span className="text-sm font-extrabold text-cyan-400 mt-1 font-mono">{selectedAlert.confidence.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-gray-500 block font-mono">Severity Status</span>
                <span className="text-sm font-extrabold text-amber-400 mt-1 font-mono">HIGH THREAT</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-gray-500 block font-mono">Incident State</span>
                <span className="text-sm font-extrabold text-gray-300 mt-1 font-mono">{selectedAlert.status.toUpperCase()}</span>
              </div>
            </div>

            {/* ACTION CENTER */}
            <div className="bg-slate-950/20 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">Remediation Action Panel</h3>
              
              {confirmMitigate ? (
                <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-lg flex items-center justify-between">
                  <div className="text-xs text-rose-200">
                    Are you sure you want to run <strong>{confirmMitigate.action.toUpperCase()}</strong> on PID {confirmMitigate.pid}?
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={isExecuting}
                      onClick={() => handleMitigateAction(confirmMitigate.pid, confirmMitigate.action)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-55 text-xs font-bold uppercase rounded cursor-pointer transition-all"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmMitigate(null)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase rounded cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmMitigate({ pid: selectedAlert.pid, action: 'kill' })}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
                  >
                    <Ban className="w-4 h-4" /> Terminate Process
                  </button>
                  
                  <button
                    onClick={() => setConfirmMitigate({ pid: selectedAlert.pid, action: 'quarantine' })}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
                  >
                    <ShieldCheck className="w-4 h-4" /> Quarantine Process
                  </button>

                  <button
                    onClick={() => setConfirmMitigate({ pid: selectedAlert.pid, action: 'ignore' })}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-500/10 hover:bg-slate-500/20 text-gray-300 border border-slate-500/20 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
                  >
                    Dismiss Incident
                  </button>
                </div>
              )}
            </div>

            {/* FORENSICS DETAILED MARKDOWN */}
            <div className="bg-slate-950/40 border border-white/5 rounded-xl p-5 flex flex-col gap-3 flex-1 min-h-[260px]">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <FileWarning className="w-4.5 h-4.5 text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono">Alert Forensics & Explanations</h3>
              </div>
              <div className="text-xs leading-relaxed text-gray-300 whitespace-pre-wrap font-mono flex-1 overflow-y-auto">
                {selectedAlert.explanation}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
