import React from 'react';
import { useSelector } from 'react-redux';
import { Shield, RefreshCw } from 'lucide-react';

export default function Header({ onSync }) {
  const wsConnected = useSelector((state) => state.telemetry.wsConnected);

  return (
    <header className="flex justify-between items-center bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl px-6 py-4 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
          <Shield className="w-8 h-8 text-indigo-400 animate-pulse" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-wider bg-gradient-to-r from-indigo-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent uppercase">
            Antigravity AI-HIDS
          </h1>
          <span className="text-xs text-gray-400 font-mono">HOST INTRUSION DETECTION SYSTEM • V1.0.0</span>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${wsConnected ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]'}`} />
          Sensor Host: <span className={wsConnected ? 'text-emerald-400' : 'text-rose-400'}>{wsConnected ? 'ACTIVE' : 'DISCONNECTED'}</span>
        </span>
        <button 
          onClick={onSync} 
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-cyan-400 border border-cyan-500/20 bg-cyan-500/10 hover:bg-cyan-500/20 cursor-pointer transition-all duration-300"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Sync
        </button>
      </div>
    </header>
  );
}
