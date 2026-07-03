import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { loginUser, registerUser } from '../store/userSlice';
import { Shield, Key, User, Lock, ArrowRight, Activity, Copy, Check } from 'lucide-react';

export default function Auth() {
  const dispatch = useDispatch();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('type-1'); // type-1 | type-2 | admin
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sensorId, setSensorId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Dynamic host registration success modal state
  const [generatedKey, setGeneratedKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please fill in all credentials.');
      return;
    }

    if (isLogin && role === 'type-2' && !sensorId.trim()) {
      setErrorMsg('Sensor ID Key is required for host access login.');
      return;
    }

    try {
      if (isLogin) {
        dispatch(loginUser({ username, role, sensorId }));
      } else {
        if (role === 'type-2') {
          // Generate unique sensor key dynamically on signup
          const cleanUser = username.toLowerCase().replace(/[^a-z0-9]/g, '');
          const newKey = `sensor-${cleanUser}-${Math.floor(10000 + Math.random() * 90000)}`;
          
          dispatch(registerUser({ username, role, sensorId: newKey }));
          setGeneratedKey(newKey);
        } else {
          dispatch(registerUser({ username, role }));
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed.');
    }
  };

  const handleCopyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-gray-100 font-sans relative overflow-hidden">
      
      {/* GLOWING AMBIENT BACKGROUND */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* HEADER LOGO */}
      <div className="flex items-center gap-2.5 mb-6 z-10">
        <Activity className="w-8 h-8 text-indigo-400" />
        <h1 className="text-2xl font-extrabold tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 font-mono">
          AI-HIDS Console
        </h1>
      </div>

      {/* AUTH CARD */}
      <div className="w-full max-w-md bg-slate-900/40 border border-white/5 backdrop-blur-xl rounded-2xl p-8 shadow-2xl z-10 relative overflow-hidden">
        
        {generatedKey ? (
          /* REGISTRATION SUCCESS CARD (TYPE-2 ONLY) */
          <div className="flex flex-col gap-5 text-center animate-fadeIn py-2 font-mono">
            <div className="mx-auto p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Shield className="w-10 h-10 animate-pulse" />
            </div>
            
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-200">Host Registered!</h2>
              <p className="text-[10px] text-gray-400 leading-relaxed mt-1">
                A unique Sensor ID Key has been generated for your host sensor instance.
              </p>
            </div>

            <div className="p-3 bg-slate-950/60 border border-white/5 rounded-lg flex items-center justify-between gap-3">
              <code className="text-xs text-emerald-400 font-bold select-all">{generatedKey}</code>
              <button
                onClick={handleCopyKey}
                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-emerald-400 transition-all cursor-pointer shrink-0"
                title="Copy Key"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="p-2.5 bg-rose-500/5 border border-rose-500/10 rounded-lg text-left">
              <p className="text-[9px] text-gray-500 leading-normal">
                * ATTENTION: Copy this key. You will need to input it to log in, and specify it in your local agent's configuration file (`.env`).
              </p>
            </div>

            <button
              onClick={() => {
                setSensorId(generatedKey);
                setGeneratedKey(null);
                setIsLogin(true);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-3 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all shadow-md font-mono"
            >
              Copy & Continue to Sign In <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          /* STANDARD LOGIN / SIGNUP CARD FORM */
          <>
            {/* TOP TAB CONTROLS */}
            <div className="flex bg-slate-950/40 border border-white/5 rounded-lg p-1 mb-6">
              <button
                onClick={() => { setIsLogin(true); setErrorMsg(''); }}
                className={`flex-1 py-2 text-xs font-bold uppercase rounded-md tracking-wider transition-all cursor-pointer ${
                  isLogin ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Access Sign In
              </button>
              <button
                onClick={() => { setIsLogin(false); setErrorMsg(''); }}
                className={`flex-1 py-2 text-xs font-bold uppercase rounded-md tracking-wider transition-all cursor-pointer ${
                  !isLogin ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* ROLE SELECTION BUTTONS */}
            <div className="mb-6 flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono block">Select Workspace Access Role</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'type-1', label: 'Monitor (Type-1)' },
                  { id: 'type-2', label: 'Host (Type-2)' },
                  { id: 'admin', label: 'Admin' }
                ].map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setRole(r.id); setErrorMsg(''); }}
                    className={`py-2 px-1 text-[9px] font-bold uppercase rounded border transition-all cursor-pointer ${
                      role === r.id 
                        ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/35' 
                        : 'bg-slate-950/20 text-gray-500 border-white/5 hover:text-gray-300 hover:bg-slate-950/40'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* DYNAMIC SUBTITLE HELPER */}
            <div className="mb-6 p-3 bg-white/5 border border-white/5 rounded-lg flex items-start gap-2">
              <Shield className="w-4.5 h-4.5 text-cyan-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-gray-400 leading-normal font-mono">
                {role === 'type-1' && 'TYPE-1: Group monitor privileges. Observe alerts across joined type-2 sensor devices.'}
                {role === 'type-2' && (isLogin 
                  ? 'TYPE-2: Active sensor operator. Verify account with username, password, and your generated Sensor Key.'
                  : 'TYPE-2: Active sensor operator. Signing up generates a security Sensor Key linked to your dashboard.')}
                {role === 'admin' && 'ADMIN: Global controls. Direct authority to delete users, clear groups, and audit parameters.'}
              </p>
            </div>

            {/* ERROR BOX */}
            {errorMsg && (
              <div className="mb-5 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg text-xs font-mono flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* INPUT FORMS */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              
              {/* Username */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono">Username</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Enter account username..." 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950/40 border border-white/5 text-xs text-gray-200 rounded-lg outline-none focus:border-indigo-500/50 transition-all font-mono"
                  />
                  <User className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-3" />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono">Access Code</label>
                <div className="relative">
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950/40 border border-white/5 text-xs text-gray-200 rounded-lg outline-none focus:border-indigo-500/50 transition-all font-mono"
                  />
                  <Lock className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-3" />
                </div>
              </div>

              {/* Sensor ID (Type 2 Login Only) */}
              {isLogin && role === 'type-2' && (
                <div className="flex flex-col gap-1.5 animate-fadeIn">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 font-mono">Sensor ID Key</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="e.g. sensor-username-12345" 
                      value={sensorId}
                      onChange={(e) => setSensorId(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-950/40 border border-cyan-500/20 text-xs text-cyan-200 rounded-lg outline-none focus:border-cyan-500/50 transition-all font-mono"
                    />
                    <Key className="w-3.5 h-3.5 text-cyan-500/70 absolute left-3 top-3" />
                  </div>
                </div>
              )}

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 py-3 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all shadow-md shadow-indigo-950/30 font-mono"
              >
                {isLogin ? 'Access Console' : 'Complete Setup'} 
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

            </form>
          </>
        )}
      </div>
      
      {/* TESTING SUGGESTION */}
      <p className="text-[10px] text-gray-600 mt-6 font-mono text-center leading-normal max-w-sm">
        DEVELOPMENT MODE: Log in with default mocks (username 'admin', 'type1', 'type2' with their corresponding roles, and key 'sensor-windows-testing' for host) to test workflows instantly.
      </p>
    </div>
  );
}
