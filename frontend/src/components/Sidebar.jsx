import React from 'react';
import { NavLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../store/hidsSlice';
import { LayoutDashboard, AlertTriangle, Brain, Ban, Users, ShieldAlert, LogOut, User } from 'lucide-react';

export default function Sidebar() {
  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.hids.user);

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/alerts', label: 'Alerts Center', icon: AlertTriangle },
    { path: '/groups', label: 'Groups Cell', icon: Users },
    { path: '/ml-model', label: 'ML Engine', icon: Brain },
    { path: '/mitigations', label: 'Mitigations', icon: Ban },
  ];

  // Dynamically append Admin Console if current user is admin
  if (currentUser && currentUser.role === 'admin') {
    menuItems.push({ path: '/admin', label: 'Admin Console', icon: ShieldAlert });
  }

  const handleLogout = () => {
    dispatch(logoutUser());
  };

  return (
    <aside className="w-64 bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 flex flex-col gap-5 shadow-lg shrink-0">
      
      {/* BRAND HEADER */}
      <div className="px-3 py-2 border-b border-white/5 flex flex-col gap-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 font-mono">Control Center</span>
        <span className="text-[9px] text-gray-500 font-mono">WORKSPACE DEPLOYMENT</span>
      </div>
      
      {/* NAVIGATION LINKS */}
      <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
                  isActive
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-gray-400 border border-transparent hover:bg-white/5 hover:text-gray-200'
                }`
              }
            >
              <Icon className="w-4.5 h-4.5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* USER PROFILE INFO & LOGOUT */}
      {currentUser && (
        <div className="flex flex-col gap-3 pt-3 border-t border-white/5 bg-slate-950/20 rounded-lg p-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-full bg-white/5 text-gray-400 shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-xs text-gray-200 truncate font-mono">{currentUser.username}</h4>
              <span className="text-[9px] text-gray-500 uppercase font-bold block tracking-wider font-mono">
                {currentUser.role}
              </span>
              {currentUser.sensor_id && (
                <span className="text-[8px] text-cyan-500 block truncate font-mono" title={currentUser.sensor_id}>
                  Key: {currentUser.sensor_id}
                </span>
              )}
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all font-mono"
          >
            <LogOut className="w-3.5 h-3.5" /> Close Session
          </button>
        </div>
      )}

      {/* FOOTER */}
      <div className="text-[8px] text-gray-600 font-mono text-center">
        ANTIGRAVITY ID SECURITY © 2026
      </div>
    </aside>
  );
}
