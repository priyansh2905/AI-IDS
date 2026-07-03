import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Brain, Settings, Play, CheckCircle2, AlertCircle, Info, Lock } from 'lucide-react';

export default function MLEngine() {
  const currentUser = useSelector((state) => state.user.user);
  const hasPermission = currentUser && (currentUser.role === 'admin' || currentUser.role === 'type-2');

  const [isTraining, setIsTraining] = useState(false);
  const [trainResult, setTrainResult] = useState(null); // { success: boolean, message: string } | null

  // Model features and their importances (reproduced from train_ml.py feature importances)
  const features = [
    { name: 'seq_anomaly_score', label: 'Sequence Anomaly Index', value: 35.5, desc: 'Bigram transitions deviating from baseline call sequences.' },
    { name: 'num_reads', label: 'File Reads Count', value: 14.6, desc: 'Abnormally high volume of read events.' },
    { name: 'unique_files', label: 'Distinct Files Accessed', value: 12.5, desc: 'Count of unique target files opened by the process.' },
    { name: 'syscall_entropy', label: 'System Call Entropy', value: 11.2, desc: 'Shannon Entropy measuring complexity/randomness of system calls.' },
    { name: 'write_ratio', label: 'Write-to-Read Ratio', value: 9.0, desc: 'Indicator of bulk directory encryption (Ransomware signatures).' },
    { name: 'num_writes', label: 'File Writes Count', value: 5.2, desc: 'Abnormally high volume of write, delete, or unlink events.' },
    { name: 'sensitive_files', label: 'Sensitive Files Access', value: 4.8, desc: 'Direct interaction with security configs, keys, or hosts files.' },
    { name: 'network_intensity', label: 'Network Operation Ratio', value: 2.7, desc: 'Outbound TCP connection density relative to local operations.' },
    { name: 'num_connections', label: 'Network Sockets Opened', value: 2.1, desc: 'Frequency of new outbound socket connections.' },
    { name: 'run_from_temp', label: 'Executed from Temp Path', value: 1.3, desc: 'Executable residing in volatile directory (Temp, AppData, Recycle Bin).' },
    { name: 'unique_ips', label: 'Outbound IP Diversity', value: 0.8, desc: 'Count of unique destination IP addresses contacted.' },
  ];

  const handleRetrain = async () => {
    setIsTraining(true);
    setTrainResult(null);

    try {
      const res = await fetch('/api/retrain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setTrainResult({ success: true, message: data.message });
      } else {
        setTrainResult({ success: false, message: data.error || data.message || "Failed to retrain model." });
      }
    } catch (err) {
      setTrainResult({ success: false, message: "Network error: unable to reach Express API server." });
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 min-w-0">
      
      {/* LEFT COLUMN: FEATURES & CLASSIFIER MODEL WEIGHTS (7/12 cols) */}
      <section className="flex-1 bg-slate-900/40 border border-white/5 rounded-xl p-5 flex flex-col gap-4 shadow-lg min-h-[500px]">
        <div>
          <h2 className="text-base font-extrabold tracking-wider uppercase text-gray-200 font-mono">Random Forest Feature Importances</h2>
          <p className="text-[10px] text-gray-500 font-mono mt-0.5">Classification weights derived from ADFA-LD telemetry training</p>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[500px] flex flex-col gap-3 pr-2">
          {features.map((feat) => (
            <div key={feat.name} className="p-3 bg-slate-950/25 border border-white/5 rounded-xl flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-xs text-gray-300 font-mono">{feat.label}</h3>
                  <span className="text-[9px] text-gray-500 font-mono">key: {feat.name}</span>
                </div>
                <span className="font-bold text-xs text-cyan-400 font-mono">{feat.value.toFixed(1)}%</span>
              </div>
              
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full"
                  style={{ width: `${feat.value * 2}%` }} // Multiply value for visual presence
                />
              </div>

              <p className="text-[10px] text-gray-400 leading-relaxed font-sans">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RIGHT COLUMN: TRAINING CONTROLS (5/12 cols) */}
      <section className="lg:w-[420px] bg-slate-900/40 border border-white/5 rounded-xl p-5 flex flex-col gap-5 shadow-lg shrink-0">
        <div>
          <h2 className="text-base font-extrabold tracking-wider uppercase text-gray-200 font-mono">Model Controller</h2>
          <p className="text-[10px] text-gray-500 font-mono mt-0.5">Train, update, and manage classifier parameters</p>
        </div>

        {/* CLASSIFIER INFO CARD */}
        <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl flex flex-col gap-3">
          <div className="flex items-center gap-2 text-indigo-400">
            <Brain className="w-5 h-5 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider font-mono">Model Properties</span>
          </div>
          
          <ul className="text-xs font-mono text-gray-400 flex flex-col gap-2 leading-relaxed">
            <li>• <strong>Algorithm:</strong> Random Forest Classifier</li>
            <li>• <strong>Estimators (Trees):</strong> 100</li>
            <li>• <strong>Max Tree Depth:</strong> 10</li>
            <li>• <strong>Scaler Fit:</strong> StandardScaler (N-dimensional)</li>
            <li>• <strong>Training Source:</strong> Synthetic ADFA-LD Anomaly Map</li>
          </ul>
        </div>

        {/* RETRAINING CONTROL */}
        <div className="bg-slate-950/20 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-cyan-400">
            <Settings className="w-4.5 h-4.5" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono">Retraining Sandbox</h3>
          </div>

          <p className="text-[11px] text-gray-400 leading-relaxed font-mono">
            Clicking the button below generates a fresh dataset of 1,200 synthetic telemetry samples, fits the StandardScaler and Random Forest classifier, and reloads parameters dynamically into backend memory.
          </p>

          {trainResult && (
            <div className={`p-3 rounded-lg border text-xs font-mono flex items-start gap-2 ${
              trainResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            }`}>
              {trainResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />}
              <span>{trainResult.message}</span>
            </div>
          )}

          <button
            disabled={!hasPermission || isTraining}
            onClick={handleRetrain}
            className={`w-full flex items-center justify-center gap-2 py-3 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-md ${
              !hasPermission 
                ? 'bg-slate-800 text-gray-500 cursor-not-allowed border border-white/5 shadow-none' 
                : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-indigo-950/30'
            }`}
          >
            {!hasPermission ? (
              <>
                <Lock className="w-4 h-4" /> Controls Locked
              </>
            ) : isTraining ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Fitting Decision Trees...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> Trigger Model Retraining
              </>
            )}
          </button>
          {!hasPermission && (
            <p className="text-[9px] text-rose-400 font-mono text-center mt-1">
              * Action restricted to Host Operators (Type-2) or Admins
            </p>
          )}
        </div>

        {/* INFO NOTICE */}
        <div className="p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-lg flex items-start gap-2.5">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p className="text-[9px] text-gray-400 leading-normal font-mono">
            NOTICE: Retraining runs asynchronously and registers automatically. In production, this can be linked to active training pipelines or user-labeled security event history.
          </p>
        </div>
      </section>
    </div>
  );
}
