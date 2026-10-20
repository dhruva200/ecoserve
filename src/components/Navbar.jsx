import React, { useState } from 'react';

export default function Navbar({
  currentUser,
  activeTab,
  setActiveTab,
  dbMode,
  hasGeminiKey,
  onRefreshStatus,
  onLogout,
  onDownloadCertificate,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState(
    () => localStorage.getItem('ecoserve_gemini_key') || ''
  );
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok: boolean, message: string }

  const isKitchen = currentUser.role === 'kitchen';

  const kitchenTabs = [
    { id: 'pantry', label: '📸 Smart Pantry Scanner' },
    { id: 'forecast', label: '🔮 AI Demand Forecast' },
    { id: 'post', label: '🍱 Post Surplus Food' },
    { id: 'my_batches', label: '📋 Posted Food Status' },
  ];

  const ngoTabs = [
    { id: 'ngo', label: '🤝 Accept Available Food' },
    { id: 'iot', label: '🌡️ Cold-Chain & ESG Impact' },
  ];

  const tabsToShow = isKitchen ? kitchenTabs : ngoTabs;

  const handleSaveAndTestKey = async (e) => {
    e.preventDefault();
    setTestingKey(true);
    setTestResult(null);

    const cleanKey = geminiKeyInput.trim();
    if (cleanKey) {
      localStorage.setItem('ecoserve_gemini_key', cleanKey);
      await fetch('/api/set-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: cleanKey }),
      });
    }

    try {
      const res = await fetch('/api/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: cleanKey }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTestResult({
          ok: true,
          message: `✅ Gemini AI Verified! Connected to model: ${data.modelUsed}`,
        });
      } else {
        setTestResult({
          ok: false,
          message: `❌ ${data.error || 'Gemini connection failed.'}`,
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: `❌ Network error testing Gemini: ${err.message}`,
      });
    }

    if (onRefreshStatus) onRefreshStatus();
    setTestingKey(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl">{isKitchen ? '👨‍🍳' : '🤝'}</span>
          <div>
            <div className="font-extrabold text-slate-900 text-sm sm:text-base">
              EcoServe
            </div>
            <div className="text-[11px] text-slate-500">{currentUser.name}</div>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {tabsToShow.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                activeTab === t.id
                  ? isKitchen
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onDownloadCertificate}
            className="px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100"
          >
            📄 ESG PDF
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition ${
              hasGeminiKey
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            {hasGeminiKey ? '🟢 AI Key Ready' : '⚠️ Set AI Key'}
          </button>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
          >
            🔁 Logout / Switch Role
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="bg-slate-900 text-white px-4 py-3 border-t border-slate-800">
          <div className="max-w-6xl mx-auto space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
              <span>
                🗄️ Database: <b>{dbMode || 'Connected'}</b>
              </span>
              <span>
                🤖 Gemini Status:{' '}
                <b>
                  {hasGeminiKey
                    ? '🟢 Key Configured in Backend'
                    : '🔴 Key Missing — Paste Below or in .env'}
                </b>
              </span>
            </div>

            <form
              onSubmit={handleSaveAndTestKey}
              className="flex flex-wrap items-center gap-2 text-xs"
            >
              <span>🔑 Gemini API Key:</span>
              <input
                type="password"
                value={geminiKeyInput}
                onChange={(e) => setGeminiKeyInput(e.target.value)}
                placeholder="Paste AIzaSy... key (or leave blank to test .env key)"
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white flex-1"
              />
              <button
                type="submit"
                disabled={testingKey}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-1.5 rounded-lg"
              >
                {testingKey ? 'Testing Gemini...' : '🧪 Save & Test Gemini AI'}
              </button>
            </form>

            {testResult && (
              <div
                className={`text-xs font-bold px-3 py-2 rounded-lg ${
                  testResult.ok
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    : 'bg-red-950 text-red-300 border border-red-700'
                }`}
              >
                {testResult.message}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
