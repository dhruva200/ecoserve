import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import KpiStatsBar from './components/KpiStatsBar.jsx';
import AuthPage from './pages/auth/AuthPage.jsx';
import KitchenDashboard from './pages/kitchen/KitchenDashboard.jsx';
import NgoDashboard from './pages/ngo/NgoDashboard.jsx';
import { downloadEsgCertificate } from './utils/esgCertificate.js';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('ecoserve_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ecoserve_user') || 'null');
      return saved?.role === 'ngo' ? 'ngo' : 'pantry';
    } catch {
      return 'pantry';
    }
  });

  const [pantryItems, setPantryItems] = useState([]);
  const [batches, setBatches] = useState([]);
  const [iotLogs, setIotLogs] = useState([]);
  const [dbMode, setDbMode] = useState('');
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [liveAlert, setLiveAlert] = useState('');

  const fetchData = async () => {
    try {
      const res = await fetch('/api/data');
      const data = await res.json();
      setPantryItems(data.pantryItems || []);
      setBatches(data.batches || []);
      setIotLogs(data.iotLogs || []);
      setDbMode(data.dbMode || '');
      setHasGeminiKey(Boolean(data.hasGeminiKey));
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.payload?.message) setLiveAlert(data.payload.message);
        fetchData();
      } catch {}
    };
    return () => ws.close();
  }, []);

  const handleAuthSuccess = (userObj) => {
    setCurrentUser(userObj);
    localStorage.setItem('ecoserve_user', JSON.stringify(userObj));
    setActiveTab(userObj.role === 'kitchen' ? 'pantry' : 'ngo');
  };

  const handleLogout = () => {
    localStorage.removeItem('ecoserve_user');
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  const isKitchen = currentUser.role === 'kitchen';
  const myPantryItems = isKitchen
    ? pantryItems.filter(
        (item) =>
          (item.kitchen_name || 'Govindas kitchen').toLowerCase().trim() ===
          (currentUser.name || '').toLowerCase().trim()
      )
    : pantryItems;

  const availableMeals = batches
    .filter((b) => b.status === 'Available')
    .reduce((s, b) => s + Number(b.servings || 0), 0);
  const totalCo2 = batches
    .reduce((s, b) => s + Number(b.co2_saved_kg || 0), 0)
    .toFixed(1);
  const latestTemp = iotLogs[0]?.temperature ?? 4.1;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <Navbar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        dbMode={dbMode}
        hasGeminiKey={hasGeminiKey}
        onRefreshStatus={fetchData}
        onLogout={handleLogout}
        onDownloadCertificate={() => downloadEsgCertificate({ currentUser, batches })}
      />

      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {liveAlert && (
          <div className="bg-emerald-900 text-white px-4 py-3 rounded-xl flex items-center justify-between text-sm">
            <span>🔔 {liveAlert}</span>
            <button onClick={() => setLiveAlert('')} className="text-xs underline">
              Dismiss
            </button>
          </div>
        )}

        <KpiStatsBar
          pantryCount={myPantryItems.length}
          availableMeals={availableMeals}
          totalCo2={totalCo2}
          latestTemp={latestTemp}
        />

        {isKitchen ? (
          <KitchenDashboard
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            currentUser={currentUser}
            myPantryItems={myPantryItems}
            batches={batches}
            fetchData={fetchData}
          />
        ) : (
          <NgoDashboard
            activeTab={activeTab}
            currentUser={currentUser}
            batches={batches}
            iotLogs={iotLogs}
            fetchData={fetchData}
            onDownloadCertificate={() =>
              downloadEsgCertificate({ currentUser, batches })
            }
          />
        )}
      </main>
    </div>
  );
}
