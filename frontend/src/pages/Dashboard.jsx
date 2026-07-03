import React, { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { exitGroup } from '../store/groupSlice';
import { logoutUser } from '../store/userSlice';
import { 
  Shield, Home, User, Users, AlertTriangle, LogOut, Key, Check, Activity, Clock, Ban, ShieldAlert 
} from 'lucide-react';

export default function Dashboard() {
  const dispatch = useDispatch();
  
  // Tab/view navigation state
  const [activeView, setActiveView] = useState('home'); // home | profile
  const [activeTab, setActiveTab] = useState('groups'); // groups | alerts

  // Modular store selectors
  const currentUser = useSelector((state) => state.user.user);
  const groupsList = useSelector((state) => state.group.groupsList);
  const usersList = useSelector((state) => state.user.usersList);
  const alerts = useSelector((state) => state.telemetry.alerts);

  // Group-based sensor filters
  const allowedSensorIds = useMemo(() => {
    if (!currentUser) return [];
    
    // Find all group IDs the current user is a member of
    const myGroupIds = groupsList.filter(g => g.members.includes(currentUser.id)).map(g => g.id);
    
    // Collect all member user IDs from these groups
    const memberIds = new Set();
    groupsList.forEach(g => {
      if (myGroupIds.includes(g.id)) {
        g.members.forEach(uid => memberIds.add(uid));
      }
    });
    
    // Include self if Type-2 host
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

  // Scoped alerts list
  const visibleAlerts = useMemo(() => {
    return alerts.filter(a => allowedSensorIds.includes(a.sensor_id || 'sensor-windows-testing'));
  }, [alerts, allowedSensorIds]);

  // Scoped groups list
  const myGroups = useMemo(() => {
    if (!currentUser) return [];
    return groupsList.filter(g => g.members.includes(currentUser.id));
  }, [groupsList, currentUser]);

  const handleLeaveGroup = (groupId) => {
    dispatch(exitGroup({ groupId, userId: currentUser.id }));
  };

  const handleLogout = () => {
    dispatch(logoutUser());
  };

  // Helper to map user ID to username
  const getUsername = (uid) => {
    const u = usersList.find(x => x.id === uid);
    return u ? u.username : 'Unknown User';
  };

  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0 min-w-0 w-full relative">
      
      {/* 1. HEADER WITH BAR NAVIGATION & PROJECT TITLE */}
      <header className="flex justify-between items-center bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl px-6 py-4 shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-indigo-400 animate-pulse" />
          <div>
            <h1 className="text-sm font-extrabold tracking-wider bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent uppercase font-mono">
              Antigravity AI-HIDS
            </h1>
            <span className="text-[9px] text-gray-500 font-mono block">COLLABORATIVE SECURITY ENVIRONMENT</span>
          </div>
        </div>
        
        {/* Navigation toggles */}
        <div className="flex bg-slate-950/40 border border-white/5 rounded-lg p-1">
          <button
            onClick={() => setActiveView('home')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase rounded-md tracking-wider transition-all cursor-pointer ${
              activeView === 'home' 
                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Home className="w-3.5 h-3.5" /> Home
          </button>
          <button
            onClick={() => setActiveView('profile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase rounded-md tracking-wider transition-all cursor-pointer ${
              activeView === 'profile' 
                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <User className="w-3.5 h-3.5" /> Profile
          </button>
        </div>
      </header>

      {/* 2. MAIN CONTENTS PANEL */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeView === 'home' ? (
          /* HOME TAB LAYOUT */
          <div className="flex-1 flex flex-col gap-6 min-h-0">
            {/* View tab switcher */}
            <div className="flex gap-4 border-b border-white/5 pb-2 shrink-0">
              <button
                onClick={() => setActiveTab('groups')}
                className={`pb-2 px-1 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer font-mono ${
                  activeTab === 'groups' 
                    ? 'border-indigo-500 text-indigo-400' 
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                Groups Cell ({myGroups.length})
              </button>
              <button
                onClick={() => setActiveTab('alerts')}
                className={`pb-2 px-1 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer font-mono ${
                  activeTab === 'alerts' 
                    ? 'border-indigo-500 text-indigo-400' 
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                Received Alerts ({visibleAlerts.length})
              </button>
            </div>

            {/* TAB CONTENTS */}
            <div className="flex-1 overflow-y-auto min-h-0">
              
              {/* GROUPS TAB PANEL */}
              {activeTab === 'groups' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myGroups.length === 0 ? (
                    <div className="col-span-full h-40 flex flex-col items-center justify-center text-gray-600 font-mono text-xs gap-2 border border-dashed border-white/5 rounded-2xl">
                      <Users className="w-8 h-8 text-white/5" />
                      <span>You do not belong to any collaborative groups.</span>
                    </div>
                  ) : (
                    myGroups.map(g => {
                      const ownerName = getUsername(g.creator_id);
                      return (
                        <div key={g.id} className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 flex flex-col gap-4 shadow-lg justify-between h-56 font-mono">
                          <div>
                            <div className="flex items-center gap-2 text-indigo-400">
                              <Users className="w-4 h-4" />
                              <h3 className="font-extrabold text-xs text-gray-200 truncate uppercase">{g.name}</h3>
                            </div>
                            
                            <p className="text-[10px] text-gray-500 mt-2">
                              Leader: <strong className="text-gray-400">{ownerName}</strong>
                            </p>
                            
                            {/* Member names list */}
                            <div className="mt-3 flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                              {g.members.map(uid => (
                                <span key={uid} className="px-2 py-0.5 bg-slate-950/40 border border-white/5 rounded text-[8px] text-gray-400 font-bold uppercase tracking-wider">
                                  {getUsername(uid)}
                                </span>
                              ))}
                            </div>
                          </div>

                          <button
                            onClick={() => handleLeaveGroup(g.id)}
                            className="w-full flex items-center justify-center gap-1 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg text-[10px] font-bold uppercase cursor-pointer transition-all shrink-0"
                          >
                            Leave Collaborative Cell
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ALERTS TAB PANEL */}
              {activeTab === 'alerts' && (
                <div className="flex flex-col gap-4">
                  {visibleAlerts.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-gray-600 font-mono text-xs gap-2 border border-dashed border-white/5 rounded-2xl">
                      <Shield className="w-8 h-8 text-emerald-500/10" />
                      <span>No received alerts on joined group channels.</span>
                    </div>
                  ) : (
                    visibleAlerts.map(a => {
                      const isCritical = a.risk_score >= 70;
                      return (
                        <div key={a.pid} className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg font-mono">
                          <div className="flex gap-4 items-start min-w-0">
                            <div className={`p-2.5 rounded-xl border shrink-0 ${isCritical ? 'bg-rose-500/10 border-rose-500/25 text-rose-400' : 'bg-amber-500/10 border-amber-500/25 text-amber-400'}`}>
                              <AlertTriangle className="w-5 h-5 animate-pulse" />
                            </div>
                            <div className="min-w-0 flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <h3 className="font-extrabold text-xs text-gray-200 select-all">PID {a.pid} • {a.name}</h3>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded font-extrabold tracking-wider border ${isCritical ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                  {a.risk_score.toFixed(0)}% RISK
                                </span>
                              </div>
                              <span className="text-[10px] text-gray-400 truncate">{a.exe || '[Simulated Executable]'}</span>
                              {a.explanations && a.explanations.length > 0 && (
                                <p className="text-[9px] text-rose-400/80 leading-normal mt-1 border-l-2 border-rose-500/35 pl-2">
                                  Indicator: {a.explanations[0]}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 w-full md:w-auto shrink-0 border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                            <span className="text-[9px] text-gray-500 flex items-center gap-1 select-none">
                              <Clock className="w-3.5 h-3.5" /> {new Date(a.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

            </div>
          </div>
        ) : (
          /* PROFILE SUBPAGE VIEW */
          <div className="flex-1 flex flex-col items-center justify-center py-6 animate-fadeIn font-mono">
            <div className="w-full max-w-md bg-slate-900/40 border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col gap-5 relative overflow-hidden">
              
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400">
                  <User className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h2 className="font-extrabold text-sm text-gray-200">Account Profile Details</h2>
                  <span className="text-[8px] text-indigo-400 uppercase tracking-widest font-bold">Workspace Autopsy Keys</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 text-xs">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-500">Username ID</span>
                  <span className="text-gray-200 font-bold">{currentUser.username}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 py-2">
                  <span className="text-gray-500">Privilege Clearance</span>
                  <span className="px-2 py-0.5 rounded border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 text-[9px] font-bold uppercase tracking-wider">
                    {currentUser.role}
                  </span>
                </div>
                {currentUser.sensor_id && (
                  <div className="flex justify-between border-b border-white/5 py-2">
                    <span className="text-gray-500 text-cyan-400">Sensor ID Key</span>
                    <span className="text-cyan-400 font-bold select-all">{currentUser.sensor_id}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2">
                  <span className="text-gray-500">Joined Group Cells</span>
                  <span className="text-gray-200 font-bold">{myGroups.length} Connected</span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-1.5 py-3 mt-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-bold uppercase cursor-pointer transition-all"
              >
                <LogOut className="w-4 h-4" /> Dissolve Session
              </button>

            </div>
          </div>
        )}
      </div>

      {/* 3. FOOTER (Leaving blank for now as requested) */}
      <footer className="py-4 border-t border-white/5 text-center text-[10px] text-gray-600 font-mono mt-auto shrink-0 select-none">
        {/* FOOTER METRICS BLANK */}
      </footer>

    </div>
  );
}
