import React from 'react';

export default function ColdChainIoT({
  iotLogs,
  fetchData,
  onDownloadCertificate,
}) {
  const handleTriggerIoT = async (temp) => {
    await fetch('/api/iot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sensor_id: 'FREEZER-01', temperature: temp }),
    });
    fetchData();
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">🌡️ IoT Cold-Storage Telemetry & ESG Report</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleTriggerIoT(4.0)}
            className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-3 py-1.5 rounded-xl"
          >
            ❄️ Normal (4.0°C)
          </button>
          <button
            onClick={() => handleTriggerIoT(10.5)}
            className="bg-red-50 text-red-700 border border-red-200 text-xs font-bold px-3 py-1.5 rounded-xl"
          >
            🔥 Trigger Alert (10.5°C)
          </button>
          <button
            onClick={onDownloadCertificate}
            className="bg-emerald-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl"
          >
            📄 Download ESG Certificate (PDF)
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {iotLogs.map((log) => (
          <div
            key={log.id}
            className="flex justify-between p-3 rounded-xl bg-slate-50 border text-xs"
          >
            <b>{log.sensor_id}</b>
            <span
              className={
                Number(log.temperature) > 7
                  ? 'text-red-600 font-bold'
                  : 'text-emerald-700 font-bold'
              }
            >
              {log.temperature}°C ({log.alert_level || log.alert_status})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
