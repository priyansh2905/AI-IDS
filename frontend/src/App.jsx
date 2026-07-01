import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

// --- INLINE SVG ICONS ---
const ShieldIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const AlertIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const TerminalIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

const FileIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const NetworkIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="3" ry="3" />
    <path d="M3 20a6 6 0 0 1 12 0v-2a6 6 0 0 1-12 0v2z" />
    <circle cx="19" cy="12" r="3" />
    <circle cx="5" cy="12" r="3" />
  </svg>
);

const RefreshIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const CloseIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function App() {
  const [processes, setProcesses] = useState([]);
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedPid, setSelectedPid] = useState(null);
  const [selectedProcessDetails, setSelectedProcessDetails] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  
  // UI Confirmation states for mitigations
  const [confirmMitigate, setConfirmMitigate] = useState(null); // { pid, action }
  const [isExecuting, setIsExecuting] = useState(false);

  const eventStreamEndRef = useRef(null);

  // Fetch initial processes, alerts, events
  const fetchData = async () => {
    try {
      const pRes = await fetch('/api/processes');
      if (pRes.ok) {
        const pData = await pRes.json();
        setProcesses(pData);
      }
      
      const aRes = await fetch('/api/alerts');
      if (aRes.ok) {
        const aData = await aRes.json();
        setAlerts(aData);
      }

      const eRes = await fetch('/api/events?limit=80');
      if (eRes.ok) {
        const eData = await eRes.json();
        setEvents(eData.reverse()); // Show oldest first for flow
      }
    } catch (err) {
      console.error("Failed to fetch initial telemetry data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // WebSockets Setup
  useEffect(() => {
    let ws;
    const connectWS = () => {
      // Derive WebSocket URL from current page location for proxy compatibility
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProto}//${window.location.host}/ws`;
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setWsConnected(true);
        console.log('[+] WebSocket connected to host API.');
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'EVENT') {
          setEvents((prev) => {
            const next = [...prev, msg.data];
            return next.slice(-100); // cap stream window size
          });
        } else if (msg.type === 'PROCESS_UPDATE') {
          setProcesses((prev) => {
            const index = prev.findIndex(p => p.pid === msg.data.pid);
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = { ...updated[index], ...msg.data };
              return updated;
            } else {
              return [msg.data, ...prev];
            }
          });
        } else if (msg.type === 'ALERT') {
          setAlerts((prev) => {
            const index = prev.findIndex(a => a.pid === msg.data.pid);
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = msg.data;
              return updated;
            } else {
              return [msg.data, ...prev];
            }
          });
        } else if (msg.type === 'MITIGATION') {
          // Update status in local process lists
          const data = msg.data;
          setProcesses((prev) => 
            prev.map(p => p.pid === data.pid ? { ...p, status: data.status } : p)
          );
          setAlerts((prev) => 
            prev.map(a => a.pid === data.pid ? { ...a, status: data.status } : a)
          );
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        console.log('[-] WebSocket disconnected. Retrying connection...');
        setTimeout(connectWS, 3000);
      };

      ws.onerror = (err) => {
        console.error('[-] WebSocket error:', err);
        ws.close();
      };
    };

    connectWS();
    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Fetch single process details when click triggered
  useEffect(() => {
    if (!selectedPid) return;
    const fetchProcDetails = async () => {
      try {
        const res = await fetch(`/api/processes/${selectedPid}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedProcessDetails(data);
        }
      } catch (err) {
        console.error("Failed to fetch process detail logs:", err);
      }
    };
    
    fetchProcDetails();
    // Poll process details periodically when drawer is open
    const interval = setInterval(fetchProcDetails, 3000);
    return () => clearInterval(interval);
  }, [selectedPid]);

  // Autoscroll System Call stream
  useEffect(() => {
    if (eventStreamEndRef.current) {
      eventStreamEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events]);

  // Search & Filter
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

  // Global statistics calculations
  const globalStats = useMemo(() => {
    const total = processes.length;
    const highRisk = alerts.filter(a => a.status === 'Active' && a.risk_score >= 70).length;
    const activeThreats = alerts.filter(a => a.status === 'Active').length;
    
    // Max risk calculation
    const maxRisk = processes.length > 0 ? Math.max(...processes.map(p => p.risk_score)) : 0;
    let systemState = 'SECURE';
    if (maxRisk >= 70) systemState = 'COMPROMISED';
    else if (maxRisk >= 40) systemState = 'WARNING';

    return { total, highRisk, activeThreats, maxRisk, systemState };
  }, [processes, alerts]);

  // Execute mitigation logic
  const handleMitigate = async (pid, action) => {
    setIsExecuting(true);
    try {
      const res = await fetch('/api/mitigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, action })
      });
      if (res.ok) {
        const resData = await res.json();
        // Clear confirmation
        setConfirmMitigate(null);
        // Refresh local details if current process
        if (selectedPid === pid) {
          const detailRes = await fetch(`/api/processes/${pid}`);
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            setSelectedProcessDetails(detailData);
          }
        }
      }
    } catch (err) {
      alert("Mitigation failed: API connection error.");
    } finally {
      setIsExecuting(false);
    }
  };

  // Sparkline generator helper
  const sparklineData = useMemo(() => {
    if (!selectedProcessDetails) return [];
    // Generate trend coordinates based on current risk
    const currentRisk = selectedProcessDetails.process.risk_score;
    // Map events or mock a small timeline
    return [
      { name: 't-4', risk: Math.max(0, currentRisk - 25) },
      { name: 't-3', risk: Math.max(0, currentRisk - 15) },
      { name: 't-2', risk: Math.min(100, currentRisk + 10) },
      { name: 't-1', risk: Math.max(0, currentRisk - 5) },
      { name: 't-0', risk: currentRisk },
    ];
  }, [selectedProcessDetails]);

  // Export Forensic report utility
  const handleExportForensicReport = () => {
    if (!selectedProcessDetails) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedProcessDetails, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href",     dataStr);
    downloadAnchor.setAttribute("download", `AI_HIDS_Forensics_PID_${selectedProcessDetails.process.pid}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div style={{ padding: '20px', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--bg-primary)' }}>
      {/* HEADER SECTION */}
      <header className="glass-panel" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldIcon className="animate-glow" style={{ width: '32px', height: '32px', color: 'var(--primary-light)' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.02em', background: 'linear-gradient(to right, #818CF8, #C084FC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ANTIGRAVITY AI-HIDS
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Host Intrusion Detection System • v1.0.0</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: wsConnected ? 'var(--color-safe)' : 'var(--color-danger)', boxShadow: wsConnected ? '0 0 8px var(--color-safe)' : '0 0 8px var(--color-danger)' }} />
            Host Sensor: {wsConnected ? 'ACTIVE' : 'DISCONNECTED'}
          </span>
          <button 
            onClick={fetchData} 
            className="badge badge-info" 
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(6, 182, 212, 0.1)', height: '28px', border: '1px solid rgba(6, 182, 212, 0.2)' }}
          >
            <RefreshIcon style={{ width: '12px', height: '12px' }} /> Sync
          </button>
        </div>
      </header>

      {/* METRICS BANNER GRID */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Banner 1: Status */}
        <div className="glass-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Host Threat Level</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: globalStats.systemState === 'SECURE' ? 'var(--color-safe)' : globalStats.systemState === 'WARNING' ? 'var(--color-warning)' : 'var(--color-danger)' }}>
            {globalStats.systemState}
          </div>
          <div style={{ width: '4px', height: '100%', position: 'absolute', top: 0, left: 0, background: globalStats.systemState === 'SECURE' ? 'var(--color-safe)' : globalStats.systemState === 'WARNING' ? 'var(--color-warning)' : 'var(--color-danger)' }} />
        </div>
        {/* Banner 2: Processes count */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Monitored Processes</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-primary)' }}>{globalStats.total}</div>
        </div>
        {/* Banner 3: Active threats */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Active Threats Detected</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: globalStats.activeThreats > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>{globalStats.activeThreats}</div>
        </div>
        {/* Banner 4: Max risk score */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Peak Risk Indicator</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: globalStats.maxRisk >= 70 ? 'var(--color-danger)' : globalStats.maxRisk >= 40 ? 'var(--color-warning)' : 'var(--color-safe)' }}>
            {globalStats.maxRisk.toFixed(1)}%
          </div>
        </div>
      </section>

      {/* DASHBOARD BODY */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', flex: 1, minHeight: 0 }}>
        
        {/* LEFT COLUMN: ACTIVE PROCESS LIST */}
        <section className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Active Host Processes</h2>
            
            {/* Search Bar */}
            <input 
              type="text"
              placeholder="Search by PID or process name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.03)', outline: 'none', color: 'var(--text-primary)', width: '220px', fontSize: '0.85rem' }}
            />
          </div>

          {/* Filtering Badges */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {['ALL', 'HIGH', 'MEDIUM', 'LOW', 'SAFE'].map(sev => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-glass)',
                  background: filterSeverity === sev ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                  color: filterSeverity === sev ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Process Table container */}
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: '600px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px' }}>PID</th>
                  <th style={{ padding: '12px' }}>Process Name</th>
                  <th style={{ padding: '12px' }}>CPU</th>
                  <th style={{ padding: '12px' }}>MEM</th>
                  <th style={{ padding: '12px', width: '140px' }}>Risk Score</th>
                  <th style={{ padding: '12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcesses.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No active processes match the filter.
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
                        onClick={() => setSelectedPid(p.pid)}
                        className="table-row-hover"
                        style={{
                          borderBottom: '1px solid var(--border-glass)', 
                          cursor: 'pointer', 
                          background: selectedPid === p.pid ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                      >
                        <td style={{ padding: '12px', fontWeight: 600 }}>{p.pid}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 500 }}>{p.name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.exe}</span>
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>{p.cpu_percent}%</td>
                        <td style={{ padding: '12px' }}>{mem.toFixed(1)}%</td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ 
                                height: '100%', 
                                width: `${risk}%`, 
                                background: isThreat ? 'var(--color-danger)' : isWarning ? 'var(--color-warning)' : 'var(--color-safe)'
                              }} />
                            </div>
                            <span style={{ 
                              fontWeight: 600, 
                              color: isThreat ? 'var(--color-danger)' : isWarning ? 'var(--color-warning)' : 'var(--color-safe)'
                            }}>
                              {risk.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span className={`badge ${p.status === 'Terminated' ? 'badge-danger' : p.status === 'Quarantined' ? 'badge-warning' : 'badge-safe'}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* RIGHT COLUMN: EVENTS FEED & ACTIVE ALERTS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
          
          {/* UPPER RIGHT: THREAT ALERTS FEED */}
          <section className="glass-panel" style={{ padding: '20px', flex: '1.2', display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertIcon style={{ width: '18px', height: '18px' }} /> Active Security Alerts
              </h2>
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                {alerts.filter(a => a.status === 'Active').length} Active
              </span>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {alerts.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No security incidents recorded. System secure.
                </div>
              ) : (
                alerts.map((a, i) => {
                  const isActive = a.status === 'Active';
                  return (
                    <div 
                      key={i} 
                      onClick={() => setSelectedPid(a.pid)}
                      style={{ 
                        padding: '12px', 
                        borderRadius: '8px', 
                        border: '1px solid rgba(239,68,68,0.15)', 
                        background: 'rgba(239,68,68,0.03)', 
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        opacity: isActive ? 1 : 0.6,
                        borderLeft: isActive ? '4px solid var(--color-danger)' : '4px solid var(--text-muted)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{a.process_name} (PID: {a.pid})</span>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-danger)' }}>{a.risk_score}% Risk</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {a.rule_triggers.map((rule, idx) => (
                          <span key={idx} style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '1px 6px', borderRadius: '3px', color: 'var(--color-danger)', fontWeight: 600 }}>
                            {rule}
                          </span>
                        ))}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'flex-end' }}>
                        {new Date(a.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* LOWER RIGHT: LIVE SYSTEM CALL EVENTS STREAM */}
          <section className="glass-panel" style={{ padding: '20px', flex: '1', display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TerminalIcon style={{ width: '18px', height: '18px', color: 'var(--primary-light)' }} /> Live Event Telemetry Stream
            </h2>
            
            <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '12px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {events.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
                  Awaiting sensor events...
                </div>
              ) : (
                events.map((e, index) => {
                  let evColor = 'var(--text-primary)';
                  let Icon = FileIcon;
                  if (e.event_type === 'network') {
                    evColor = 'var(--color-info)';
                    Icon = NetworkIcon;
                  } else if (e.event_type === 'process') {
                    evColor = 'var(--primary-light)';
                    Icon = TerminalIcon;
                  } else if (e.event_type === 'file' && e.action === 'write') {
                    evColor = 'var(--color-warning)';
                  }
                  
                  return (
                    <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '4px' }}>
                      <Icon style={{ width: '12px', height: '12px', marginTop: '3px', flexShrink: 0, color: evColor }} />
                      <div style={{ flex: 1, wordBreak: 'break-all' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>[{new Date(e.timestamp).toLocaleTimeString()}] </span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.process_name} ({e.pid})</span>
                        <span style={{ color: evColor }}>::{e.action.toUpperCase()}</span>
                        <span style={{ color: 'var(--text-muted)' }}> → {e.target_path || e.details}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={eventStreamEndRef} />
            </div>
          </section>

        </div>
      </div>

      {/* DETAIL MODAL / DRAWER */}
      {selectedPid && selectedProcessDetails && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '500px', background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-glass)', boxShadow: '-10px 0 30px rgba(0,0,0,0.6)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 1000, overflowY: 'auto' }}>
          
          {/* Drawer Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{selectedProcessDetails.process.name}</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>PID: {selectedProcessDetails.process.pid} • {selectedProcessDetails.process.username}</span>
            </div>
            <button 
              onClick={() => { setSelectedPid(null); setSelectedProcessDetails(null); }}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
            >
              <CloseIcon style={{ width: '20px', height: '20px' }} />
            </button>
          </div>

          <hr style={{ border: 'none', height: '1px', background: 'var(--border-glass)', margin: 0 }} />

          {/* Core Info Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>Executable Location</span>
              <code style={{ background: 'rgba(0,0,0,0.2)', padding: '4px 6px', borderRadius: '4px', wordBreak: 'break-all', display: 'block', marginTop: '4px' }}>
                {selectedProcessDetails.process.exe || '[Unknown/None]'}
              </code>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>Command Line parameters</span>
              <code style={{ background: 'rgba(0,0,0,0.2)', padding: '4px 6px', borderRadius: '4px', wordBreak: 'break-all', display: 'block', marginTop: '4px' }}>
                {selectedProcessDetails.process.cmdline || '[Empty]'}
              </code>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Parent Process</span>
                <div style={{ marginTop: '4px' }}>{selectedProcessDetails.process.parent_name} ({selectedProcessDetails.process.parent_pid})</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Risk Level</span>
                <div style={{ 
                  marginTop: '4px', 
                  fontWeight: 800, 
                  color: selectedProcessDetails.process.risk_score >= 50 ? 'var(--color-danger)' : selectedProcessDetails.process.risk_score >= 20 ? 'var(--color-warning)' : 'var(--color-safe)' 
                }}>
                  {selectedProcessDetails.process.classification.toUpperCase()} ({selectedProcessDetails.process.risk_score.toFixed(1)}%)
                </div>
              </div>
            </div>
          </div>

          {/* Sparkline Graph */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 700 }}>Risk Score Trend Over Time</h4>
            <div style={{ width: '100%', height: '80px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="risk" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorRisk)" />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }} labelStyle={{ display: 'none' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Explanation details */}
          {selectedProcessDetails.process.risk_score >= 20 && (
            <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-danger)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertIcon style={{ width: '14px', height: '14px' }} /> AI Threat Explanation
              </h4>
              <div 
                style={{ fontSize: '0.8rem', lineHeight: '1.4', color: 'var(--text-secondary)' }}
                dangerouslySetInnerHTML={{ 
                  __html: (
                    alerts.find(a => a.pid === selectedProcessDetails.process.pid)?.explanation || 
                    "No formal analysis records generated for this process."
                  )
                  .replace(/\n/g, '<br/>')
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/### (.*?)/g, '<h5 style="color:var(--text-primary);margin:8px 0 4px 0">$1</h5>')
                  .replace(/- \*\*(.*?)\*\*/g, '• <strong>$1</strong>')
                }} 
              />
            </div>
          )}

          {/* MITIGATION ACTIONS PANEL */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>Remediation Controls</h4>
            
            {confirmMitigate ? (
              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-danger)', fontWeight: 600 }}>
                  WARNING: Are you sure you want to execute {confirmMitigate.action.toUpperCase()} on this process? This might crash application operations.
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    disabled={isExecuting}
                    onClick={() => handleMitigate(confirmMitigate.pid, confirmMitigate.action)}
                    style={{ flex: 1, padding: '8px', background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    {isExecuting ? "Executing..." : "Confirm Execution"}
                  </button>
                  <button 
                    disabled={isExecuting}
                    onClick={() => setConfirmMitigate(null)}
                    style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  disabled={selectedProcessDetails.process.status === 'Terminated'}
                  onClick={() => setConfirmMitigate({ pid: selectedProcessDetails.process.pid, action: 'kill' })}
                  style={{ 
                    flex: 1, 
                    padding: '10px', 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    color: 'var(--color-danger)', 
                    border: '1px solid rgba(239, 68, 68, 0.25)', 
                    borderRadius: '6px', 
                    cursor: 'pointer', 
                    fontSize: '0.8rem', 
                    fontWeight: 600,
                    opacity: selectedProcessDetails.process.status === 'Terminated' ? 0.5 : 1
                  }}
                >
                  Terminate Process
                </button>
                <button 
                  disabled={selectedProcessDetails.process.status !== 'Running'}
                  onClick={() => setConfirmMitigate({ pid: selectedProcessDetails.process.pid, action: 'quarantine' })}
                  style={{ 
                    flex: 1, 
                    padding: '10px', 
                    background: 'rgba(245, 158, 11, 0.1)', 
                    color: 'var(--color-warning)', 
                    border: '1px solid rgba(245, 158, 11, 0.25)', 
                    borderRadius: '6px', 
                    cursor: 'pointer', 
                    fontSize: '0.8rem', 
                    fontWeight: 600,
                    opacity: selectedProcessDetails.process.status !== 'Running' ? 0.5 : 1
                  }}
                >
                  Quarantine (Suspend)
                </button>
              </div>
            )}

            <button 
              onClick={handleExportForensicReport}
              style={{ padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}
            >
              Export Forensic Audit Report (JSON)
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
