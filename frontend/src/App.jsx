import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { 
  setProcesses, updateProcess, 
  setAlerts, updateAlert, 
  setEvents, addEvent, 
  updateMitigation, setWsConnected,
  setSelectedProcessDetails
} from './store/hidsSlice';

// Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ProcessDetailsDrawer from './components/ProcessDetailsDrawer';

// Pages
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import MLEngine from './pages/MLEngine';
import Mitigations from './pages/Mitigations';
import Groups from './pages/Groups';
import AdminConsole from './pages/AdminConsole';

export default function App() {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.hids.token);
  const currentUser = useSelector((state) => state.hids.user);
  const selectedPid = useSelector((state) => state.hids.selectedPid);

  // Fetch initial processes, alerts, events
  const fetchData = async () => {
    if (!token) return;
    try {
      const pRes = await fetch('/api/processes');
      if (pRes.ok) {
        const pData = await pRes.json();
        dispatch(setProcesses(pData));
      }
      
      const aRes = await fetch('/api/alerts');
      if (aRes.ok) {
        const aData = await aRes.json();
        dispatch(setAlerts(aData));
      }

      const eRes = await fetch('/api/events?limit=80');
      if (eRes.ok) {
        const eData = await eRes.json();
        dispatch(setEvents(eData.reverse())); // Show oldest first in console streams
      }
    } catch (err) {
      console.error("Failed to fetch initial telemetry data:", err);
    }
  };

  // Poll details of selected process
  const fetchSelectedProcessDetails = async (pid) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/processes/${pid}`);
      if (res.ok) {
        const data = await res.json();
        dispatch(setSelectedProcessDetails(data));
      }
    } catch (err) {
      console.error("Failed to fetch process details:", err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  // WebSockets Connection (Only when logged in)
  useEffect(() => {
    if (!token) return;
    let ws;
    const connectWS = () => {
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProto}//${window.location.host}/ws`;
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        dispatch(setWsConnected(true));
        console.log('[+] WebSocket connected to host API.');
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'EVENT') {
          dispatch(addEvent(msg.data));
        } else if (msg.type === 'PROCESS_UPDATE') {
          dispatch(updateProcess(msg.data));
        } else if (msg.type === 'ALERT') {
          dispatch(updateAlert(msg.data));
        } else if (msg.type === 'MITIGATION') {
          const { pid, status } = msg.data;
          dispatch(updateMitigation({ pid, status }));
        }
      };

      ws.onclose = () => {
        dispatch(setWsConnected(false));
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
  }, [dispatch, token]);

  // Polling selected process details
  useEffect(() => {
    if (!selectedPid || !token) return;
    fetchSelectedProcessDetails(selectedPid);
    const interval = setInterval(() => fetchSelectedProcessDetails(selectedPid), 3000);
    return () => clearInterval(interval);
  }, [selectedPid, token]);

  // Mitigation API call handler
  const handleMitigate = async (pid, action) => {
    try {
      const res = await fetch('/api/mitigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, action })
      });
      if (res.ok) {
        const resData = await res.json();
        if (selectedPid === pid) {
          fetchSelectedProcessDetails(pid);
        }
      }
    } catch (err) {
      console.error("Failed to run mitigation command:", err);
      alert("Mitigation action failed: connection error.");
    }
  };

  // 1. ROUTE GUARD: Redirect to login if token is absent
  if (!token) {
    return <Auth />;
  }

  // 2. MAIN LAYOUT FOR AUTHENTICATED USERS
  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 flex p-5 gap-6 font-sans antialiased overflow-hidden w-full">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col gap-6 min-w-0 h-[calc(100vh-40px)] overflow-y-auto">
        <Header onSync={fetchData} />
        
        <main className="flex-1 flex flex-col min-h-0">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/alerts" element={<Alerts onMitigate={handleMitigate} />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/ml-model" element={<MLEngine />} />
            <Route path="/mitigations" element={<Mitigations />} />
            
            {/* Guarded Admin Console Route */}
            <Route 
              path="/admin" 
              element={currentUser?.role === 'admin' ? <AdminConsole /> : <Navigate to="/" replace />} 
            />
          </Routes>
        </main>
      </div>

      {/* Details Side Panel Drawer */}
      <ProcessDetailsDrawer onMitigate={handleMitigate} />
    </div>
  );
}
