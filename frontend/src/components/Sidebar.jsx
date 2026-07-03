import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, Brain, Ban } from 'lucide-react';

export default function Sidebar() {
  const menuItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/alerts', label: 'Alerts Center', icon: AlertTriangle },
    { path: '/ml-model', label: 'ML Engine', icon: Brain },
    { path: '/mitigations', label: 'Mitigations', icon: Ban },
  ];

  return (
    <aside className="w-64 bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 flex flex-col gap-6 shadow-lg">
      <div className="px-3 py-2">
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">Control Center</span>
      </div>
      <nav className="flex flex-col gap-1.5 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold uppercase tracking-wider transition-all duration-300 ${
                  isActive
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-gray-400 border border-transparent hover:bg-white/5 hover:text-gray-200'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/5 text-[10px] text-gray-500 font-mono text-center">
        ANTIGRAVITY SYSTEM SECURITY
      </div>
    </aside>
  );
}
