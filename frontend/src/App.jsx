import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { 
  setProcesses, updateProcess, 
  setAlerts, updateAlert, 
  setEvents, addEvent, 
  updateMitigation, setWsConnected,
  setSelectedProcessDetails
} from './store/telemetrySlice';
import { fetchUsers } from './store/userSlice';
import { fetchGroups } from './store/groupSlice';

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
  
  // Selectors mapped to modular slices
  const token = useSelector((state) => state.user.token);
  const currentUser = useSelector((state) => state.user.user);
  const selectedPid = useSelector((state) => state.telemetry.selectedPid);

  // Fetch initial processes, alerts, events
  const fetchData = async () => {
    if (!token) return;
    try {
      dispatch(fetchUsers());
      dispatch(fetchGroups());
      console.log("[API Call] GET /api/telemetry/latest - Fetching initial process snapshots...");
      const pRes = await fetch('/api/telemetry/latest');
      console.log(`[API Response] GET /api/telemetry/latest - Status: ${pRes.status} ${pRes.statusText}`);
      if (pRes.ok) {
        const pData = await pRes.json();
        console.log("[API Payload Received] Telemetry data:", pData);
        dispatch(setProcesses(Array.isArray(pData.data) ? pData.data : []));
      }
      
      console.log("[API Call] GET /api/alerts?limit=100 - Fetching recent security alerts...");
      const aRes = await fetch('/api/alerts?limit=100');
      console.log(`[API Response] GET /api/alerts - Status: ${aRes.status} ${aRes.statusText}`);
      if (aRes.ok) {
        const aData = await aRes.json();
        console.log("[API Payload Received] Alerts data:", aData);
        dispatch(setAlerts(Array.isArray(aData.data) ? aData.data : []));
      }

      console.log("[API Call] GET /api/events?limit=80 - Fetching raw forensic events...");
      const eRes = await fetch('/api/events?limit=80');
      console.log(`[API Response] GET /api/events - Status: ${eRes.status} ${eRes.statusText}`);
      if (eRes.ok) {
        const eData = await eRes.json();
        console.log("[API Payload Received] Events data:", eData);
        const eventsArr = Array.isArray(eData.data) ? eData.data : [];
        dispatch(setEvents([...eventsArr].reverse())); // oldest first in console
      }
    } catch (err) {
      console.error("Failed to fetch initial telemetry data:", err);
    }
  };

  // Poll details of selected process
  const fetchSelectedProcessDetails = async (pid) => {
    if (!token) return;
    try {
      console.log(`[API Call] GET /api/telemetry/latest - Polling forensics detail for PID: ${pid}`);
      const res = await fetch(`/api/telemetry/latest`);
      if (res.ok) {
        const data = await res.json();
        const proc = Array.isArray(data.data)
          ? data.data.find(p => p.pid === pid)
          : null;
        if (proc) {
          console.log(`[API Response] GET /api/telemetry/latest - PID: ${pid} matches found:`, proc);
          dispatch(setSelectedProcessDetails({ process: proc }));
        }
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
        try {
          const msg = JSON.parse(event.data);
          // Broadcaster sends lowercase type strings: telemetry | alert | event | mitigation_status | alert_update
          if (msg.type === 'event') {
            dispatch(addEvent(msg.data));
          } else if (msg.type === 'telemetry') {
            // Full sweep — update each process in the list
            const processes = Array.isArray(msg.data?.processes) ? msg.data.processes : [];
            processes.forEach(p => dispatch(updateProcess(p)));
          } else if (msg.type === 'alert') {
            dispatch(updateAlert(msg.data));
          } else if (msg.type === 'alert_update') {
            dispatch(updateAlert(msg.data));
          } else if (msg.type === 'mitigation_status') {
            const { pid, type: actionType, status } = msg.data;
            if (pid) dispatch(updateMitigation({ pid, status: actionType || status }));
          }
        } catch (e) {
          console.warn('[-] Could not parse WS message:', event.data);
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
      console.log(`[API Call] POST /api/mitigate - Directing action: ${action} on PID: ${pid}`);
      const res = await fetch('/api/mitigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, action })
      });
      console.log(`[API Response] POST /api/mitigate - Status: ${res.status} ${res.statusText}`);
      if (res.ok) {
        const payload = await res.json();
        console.log("[API Payload Received] Mitigation acknowledgement:", payload);
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
