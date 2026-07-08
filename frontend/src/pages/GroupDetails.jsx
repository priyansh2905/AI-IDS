import React, { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedPid } from '../store/telemetrySlice';
import { 
  Users, Shield, Radio, Activity, ArrowLeft, AlertTriangle, Clock, 
  CheckCircle2, AlertCircle, ShieldAlert 
} from 'lucide-react';

export default function GroupDetails({ onMitigate }) {
  const { id } = useParams();
  const dispatch = useDispatch();

  const currentUser = useSelector((state) => state.user.user);
  const groupsList = useSelector((state) => state.group.groupsList);
  const usersList = useSelector((state) => state.user.usersList);
  const alerts = useSelector((state) => state.telemetry.alerts);

  const [sensorStatus, setSensorStatus] = useState({});

  const group = groupsList.find(g => g.id === id);

  // Helper to map userId to username and role
  const getUserDetails = (uid) => {
    const user = usersList.find(u => u.id === uid);
    return user 
      ? { id: user.id, username: user.username, role: user.role, sensor_id: user.sensor_id } 
      : { id: uid, username: 'Unknown', role: 'unknown', sensor_id: null };
  };

  useEffect(() => {
    if (!group) return;

    const fetchSensorStatuses = async () => {
      const statuses = {};
      const type2Members = group.members
        .map(uid => getUserDetails(uid))
        .filter(m => m.role === 'type-2' && m.sensor_id);

      for (const m of type2Members) {
        try {
          const res = await fetch(`/api/telemetry/latest?sensor_id=${m.sensor_id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.received_at) {
              const recAt = new Date(data.received_at);
              if (new Date() - recAt < 45000) { // 45 seconds tolerance
                statuses[m.sensor_id] = 'Online (Monitoring)';
              } else {
                statuses[m.sensor_id] = 'Offline (Inactive)';
              }
            } else {
              statuses[m.sensor_id] = 'Offline (No Data)';
            }
          } else {
            statuses[m.sensor_id] = 'Offline (Unreachable)';
          }
        } catch (e) {
          statuses[m.sensor_id] = 'Offline (Error)';
        }
      }
      setSensorStatus(statuses);
    };

    fetchSensorStatuses();
    const interval = setInterval(fetchSensorStatuses, 8000);
    return () => clearInterval(interval);
  }, [group, usersList]);

  if (!group) {
    return <Navigate to="/groups" replace />;
  }

  const leader = getUserDetails(group.creator_id);

  // Filter alerts specific to this group's sensors
  const groupSensorIds = group.members
    .map(uid => getUserDetails(uid))
    .filter(m => m.role === 'type-2' && m.sensor_id)
    .map(m => m.sensor_id);

  const groupAlerts = alerts.filter(a => groupSensorIds.includes(a.sensor_id));

  const isOwner = group.creator_id === currentUser.id;

  return (
    <div className="flex-1 flex flex-col gap-6 min-w-0 font-mono text-xs">
      
      {/* TOP HEADER ACTION */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link 
            to="/groups" 
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-white/5 text-gray-400 hover:text-white rounded-lg transition-all flex items-center justify-center cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <span className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold">Collaborative Cell Overview</span>
            <h1 className="text-base font-extrabold tracking-wider uppercase text-gray-200 mt-0.5">{group.name}</h1>
          </div>
        </div>

        {isOwner && (
          <div className="flex gap-2 shrink-0 select-none">
            <Link 
              to="/groups" 
              className="px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
            >
              Add Members
            </Link>
            <Link 
              to="/groups" 
              className="px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
            >
              Requests ({group.pending_requests?.length || 0})
            </Link>
          </div>
        )}
      </div>

      {/* METRICS / GROUP DETAILS */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 select-none">
        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-4 flex flex-col justify-between h-20 shadow">
          <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Group Search Key</span>
          <span className="text-gray-200 font-bold text-xs select-all truncate" title={group.group_key}>
            {group.group_key}
          </span>
        </div>
        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-4 flex flex-col justify-between h-20 shadow">
          <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Cell Leader</span>
          <span className="text-gray-200 font-bold text-xs truncate">
            {leader.username}
          </span>
        </div>
        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-4 flex flex-col justify-between h-20 shadow">
          <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Access Status</span>
          <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider self-start mt-1 ${
            group.status === 'public' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            {group.status}
          </span>
        </div>
        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-4 flex flex-col justify-between h-20 shadow">
          <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Group Threat Alerts</span>
          <span className={`text-xs font-bold ${groupAlerts.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {groupAlerts.length} Active {groupAlerts.length === 1 ? 'Alert' : 'Alerts'}
          </span>
        </div>
      </section>

      {/* TWO PANEL CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-0">
        
        {/* MEMBERS INDEX LIST (2/5 cols) */}
        <section className="lg:col-span-2 bg-slate-900/40 border border-white/5 rounded-xl p-5 shadow-lg flex flex-col gap-4 min-h-[400px]">
          <div>
            <h2 className="text-sm font-extrabold tracking-wider uppercase text-gray-200 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-400" /> Cell Members ({group.members.length})
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Assigned endpoint clearances and real-time connectivity status</p>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[380px] flex flex-col gap-3 pr-1">
            {group.members.map(uid => {
              const m = getUserDetails(uid);
              const isSelf = m.id === currentUser.id;
              
              let roleBadge = 'border-slate-500/25 bg-slate-500/10 text-slate-400';
              if (m.role === 'admin') roleBadge = 'border-rose-500/25 bg-rose-500/10 text-rose-400';
              else if (m.role === 'type-2') roleBadge = 'border-cyan-500/25 bg-cyan-500/10 text-cyan-400';

              let statusText = 'Console Session Active';
              let isOnline = true;
              if (m.role === 'type-2') {
                statusText = m.sensor_id ? (sensorStatus[m.sensor_id] || 'Offline (Inactive)') : 'Offline (No Sensor)';
                isOnline = statusText.includes('Online') || statusText.includes('Monitoring');
              }

              return (
                <div key={m.id} className="p-3.5 bg-slate-950/25 border border-white/5 rounded-xl flex items-center justify-between gap-4">
                  <div className="min-w-0 flex flex-col gap-1">
                    <span className="font-extrabold text-gray-200 text-xs truncate">
                      {m.username} {isSelf && <span className="text-[9px] text-gray-500">(you)</span>}
                    </span>
                    <span className={`px-2 py-0.5 rounded border text-[8px] font-extrabold uppercase tracking-wider self-start ${roleBadge}`}>
                      {m.role}
                    </span>
                  </div>
                  
                  <div className="text-right shrink-0">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${
                      isOnline ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      <Radio className={`w-3.5 h-3.5 ${isOnline ? 'animate-pulse' : ''}`} /> {statusText}
                    </span>
                    {m.sensor_id && (
                      <span className="block text-[8px] text-gray-500 mt-1 select-all" title={m.sensor_id}>
                        Mapping: {m.sensor_id}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ALERTS FEED LIST (3/5 cols) */}
        <section className="lg:col-span-3 bg-slate-900/40 border border-white/5 rounded-xl p-5 shadow-lg flex flex-col gap-4 min-h-[400px]">
          <div>
            <h2 className="text-sm font-extrabold tracking-wider uppercase text-gray-200 flex items-center gap-1.5">
              <ShieldAlert className="w-4.5 h-4.5 text-rose-400" /> Endpoint Threat Alerts
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Live anomalies and rule classifier triggers raised by cell endpoints</p>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[380px] flex flex-col gap-3 pr-1">
            {groupAlerts.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-gray-600 text-xs gap-2 border border-dashed border-white/5 rounded-2xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/20" />
                <span>No threats detected on this cell's endpoints.</span>
              </div>
            ) : (
              groupAlerts.map(a => {
                const isCritical = a.risk_score >= 70;
                return (
                  <div 
                    key={a.pid} 
                    onClick={() => dispatch(setSelectedPid(a.pid))}
                    className="p-4 bg-slate-950/20 hover:bg-slate-950/40 border border-white/5 hover:border-indigo-500/30 rounded-xl flex items-center justify-between gap-4 transition-all cursor-pointer hover:scale-[1.01]"
                  >
                    <div className="min-w-0 flex gap-3 items-start">
                      <div className={`p-2 rounded border shrink-0 ${
                        isCritical ? 'bg-rose-500/10 border-rose-500/25 text-rose-400' : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                      }`}>
                        <AlertTriangle className="w-4 h-4 animate-pulse" />
                      </div>
                      <div className="min-w-0 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-xs text-gray-200">PID {a.pid} • {a.name}</h3>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-extrabold tracking-wider border ${
                            isCritical ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {a.risk_score.toFixed(0)}% RISK
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 truncate">{a.exe || '[Simulated Executable]'}</span>
                        <span className="text-[9px] text-gray-500 mt-1 select-all">Sensor: {a.sensor_id}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                      <span className="text-[9px] text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(a.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
