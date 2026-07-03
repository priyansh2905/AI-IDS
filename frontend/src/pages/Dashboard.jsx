import React, { useMemo, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedPid, setSearchQuery, setFilterSeverity } from '../store/hidsSlice';
import { Search, RefreshCw, Eye, Server, AlertTriangle, ShieldCheck, TrendingUp, Cpu, HardDrive } from 'lucide-react';

export default function Dashboard() {
  const dispatch = useDispatch();
  const processes = useSelector((state) => state.hids.processes);
  const alerts = useSelector((state) => state.hids.alerts);
  const events = useSelector((state) => state.hids.events);
  const selectedPid = useSelector((state) => state.hids.selectedPid);
  const searchQuery = useSelector((state) => state.hids.searchQuery);
  const filterSeverity = useSelector((state) => state.hids.filterSeverity);

  const eventEndRef = useRef(null);

  // Auto-scroll event logs
  useEffect(() => {
    if (eventEndRef.current) {
      eventEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events]);

  // Processes filtering
  const filteredProcesses = useMemo(() => {
    return processes.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.pid.toString().includes(searchQuery);
      
      let matchSeverity = true;
      if (filterSeverity === 'HIGH') matchSeverity = p.risk_score >= 70;
      else if (filterSeverity === 'MEDIUM') matchSeverity = p.risk_score >= 40 && p.risk_score < 70;
      else if (filterSeverity === 'LOW') matchSeverity = p.risk_score >= 15 && p.risk_score < 40;
      else if (filterSeverity === 'SAFE') matchSeverity = p.risk_score < 15;
      
      return matchSearch && matchSeverity;
    });
  }, [processes, searchQuery, filterSeverity]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = processes.length;
    const activeThreats = alerts.filter(a => a.status === 'Active').length;
    const maxRisk = processes.length > 0 ? Math.max(...processes.map(p => p.risk_score)) : 0;
    
    let systemState = 'SECURE';
    if (maxRisk >= 70) systemState = 'COMPROMISED';
    else if (maxRisk >= 40) systemState = 'WARNING';

    return { total, activeThreats, maxRisk, systemState };
  }, [processes, alerts]);

  return (
    <div className="flex flex-col gap-6 flex-1 min-w-0">
      {/* STATS BANNER GRID */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* State */}
        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between h-28 shadow-md">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">System Threat Level</span>
          <div className={`text-2xl font-extrabold font-mono mt-1 ${
            stats.systemState === 'SECURE' ? 'text-emerald-400' : stats.systemState === 'WARNING' ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {stats.systemState}
          </div>
          <div className={`w-1.5 h-full absolute top-0 left-0 ${
            stats.systemState === 'SECURE' ? 'bg-emerald-500' : stats.systemState === 'WARNING' ? 'bg-amber-500' : 'bg-rose-500'
          }`} />
        </div>

        {/* Total processes */}
        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-5 flex flex-col justify-between h-28 shadow-md">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Monitored Processes</span>
            <Server className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-extrabold text-gray-100 font-mono mt-1">{stats.total}</div>
        </div>

        {/* Active Threats */}
        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-5 flex flex-col justify-between h-28 shadow-md">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Active Threats</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className={`text-3xl font-extrabold font-mono mt-1 ${
            stats.activeThreats > 0 ? 'text-rose-400 animate-pulse' : 'text-gray-100'
          }`}>{stats.activeThreats}</div>
        </div>

        {/* Max Risk */}
        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-5 flex flex-col justify-between h-28 shadow-md">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Peak Risk score</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className={`text-3xl font-extrabold font-mono mt-1 ${
            stats.maxRisk >= 70 ? 'text-rose-400' : stats.maxRisk >= 40 ? 'text-amber-400' : 'text-emerald-400'
          }`}>{stats.maxRisk.toFixed(1)}%</div>
        </div>
      </section>

      {/* DASHBOARD COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* LEFT COLUMN: ACTIVE PROCESS LIST (7/12 cols) */}
        <section className="lg:col-span-7 bg-slate-900/40 border border-white/5 rounded-xl p-5 flex flex-col gap-4 shadow-lg min-h-[500px]">
          <div className="flex justify-between items-center gap-4">
            <h2 className="text-base font-extrabold tracking-wider uppercase text-gray-200 font-mono">Active Host Processes</h2>
            
            {/* Search Input */}
            <div className="relative w-60">
              <input 
                type="text"
                placeholder="Filter by name or PID..."
                value={searchQuery}
                onChange={(e) => dispatch(setSearchQuery(e.target.value))}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-white/5 bg-slate-950/40 text-xs font-medium text-gray-200 outline-none focus:border-indigo-500/50 transition-all font-mono"
              />
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Filtering buttons */}
          <div className="flex gap-1.5">
            {['ALL', 'HIGH', 'MEDIUM', 'LOW', 'SAFE'].map(sev => (
              <button
                key={sev}
                onClick={() => dispatch(setFilterSeverity(sev))}
                className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                  filterSeverity === sev 
                    ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/35' 
                    : 'bg-slate-950/20 text-gray-500 border-white/5 hover:text-gray-300 hover:bg-slate-950/40'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Table Container */}
          <div className="overflow-y-auto flex-1 max-h-[500px] border border-white/5 rounded-lg bg-slate-950/10">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-slate-950/30 text-gray-400 font-mono uppercase tracking-wider">
                  <th className="p-3">PID</th>
                  <th className="p-3">Process Name</th>
                  <th className="p-3 text-center">CPU</th>
                  <th className="p-3 text-center">MEM</th>
                  <th className="p-3 w-36">Risk Index</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcesses.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-600 font-mono">
                      No active processes matched criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProcesses.map(p => {
                    const risk = p.risk_score ?? 0;
                    const mem = p.memory_percent ?? 0;
                    const isThreat = risk >= 50;
                    const isWarning = risk >= 20 && risk < 50;
                    
                    return (
                      <tr 
                        key={p.pid} 
                        onClick={() => dispatch(setSelectedPid(p.pid))}
                        className={`border-b border-white/5 transition-all duration-200 cursor-pointer hover:bg-indigo-500/5 ${
                          selectedPid === p.pid ? 'bg-indigo-500/10' : ''
                        }`}
                      >
                        <td className="p-3 font-bold font-mono text-gray-300">{p.pid}</td>
                        <td className="p-3">
                          <div className="flex flex-col max-w-[180px]">
                            <span className="font-semibold text-gray-200 truncate">{p.name}</span>
                            <span className="text-[10px] text-gray-500 truncate font-mono" title={p.exe}>{p.exe || '[Simulated Executable]'}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center font-mono text-gray-300">{p.cpu_percent}%</td>
                        <td className="p-3 text-center font-mono text-gray-300">{mem.toFixed(1)}%</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  isThreat ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                                }`} 
                                style={{ width: `${risk}%` }}
                              />
                            </div>
                            <span className={`font-bold font-mono text-[10px] ${
                              isThreat ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
                            }`}>{risk.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <button className="p-1 rounded bg-white/5 text-gray-400 hover:text-indigo-400 transition-all hover:bg-white/10 cursor-pointer">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* RIGHT COLUMN: LIVE TELEMETRY CONSOLE (5/12 cols) */}
        <section className="lg:col-span-5 bg-slate-900/40 border border-white/5 rounded-xl p-5 flex flex-col gap-4 shadow-lg min-h-[500px]">
          <div>
            <h2 className="text-base font-extrabold tracking-wider uppercase text-gray-200 font-mono">Live Telemetry Sensor Log</h2>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">Streaming direct kernel and process events...</p>
          </div>

          <div className="flex-1 bg-slate-950/80 border border-white/5 rounded-xl p-4 overflow-y-auto max-h-[520px] font-mono text-[11px] leading-relaxed text-gray-400 flex flex-col gap-3 shadow-inner">
            {events.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-600">
                Waiting for host sensor link...
              </div>
            ) : (
              events.map((e, idx) => {
                let colorClass = 'text-cyan-400';
                if (e.event_type === 'file') {
                  colorClass = e.action === 'write' ? 'text-amber-400' : 'text-emerald-400';
                } else if (e.event_type === 'process') {
                  colorClass = 'text-purple-400';
                }
                
                return (
                  <div key={idx} className="border-b border-white/5 pb-2 last:border-b-0">
                    <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                      <span>[{new Date(e.timestamp).toLocaleTimeString()}]</span>
                      <span className={`font-bold ${colorClass}`}>{e.event_type.toUpperCase()} / {e.action.toUpperCase()}</span>
                    </div>
                    <p className="text-gray-300">
                      <span className="text-indigo-400 font-bold">{e.process_name}</span> (PID {e.pid}) ➡️ <span className="text-gray-400">{e.target_path || 'No target'}</span>
                    </p>
                    {e.details && (
                      <p className="text-[10px] text-gray-500 mt-0.5">{e.details}</p>
                    )}
                  </div>
                );
              })
            )}
            <div ref={eventEndRef} />
          </div>
        </section>
      </div>
    </div>
  );
}
