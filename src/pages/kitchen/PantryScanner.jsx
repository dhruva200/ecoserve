import React, { useState, useRef, useEffect } from 'react';
import { normalizeImageToJpeg } from '../../utils/imageHelper.js';

export default function PantryScanner({
  currentUser,
  myPantryItems,
  fetchData,
  setActiveTab,
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [scanningImage, setScanningImage] = useState(false);
  const [lastScannedItem, setLastScannedItem] = useState(null);
  const [scanError, setScanError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setScanError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      setScanError('Camera permission denied. Please use "Upload Photo" instead.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const scanImage = async ({ jpegDataUrl, fileName = '', dominantColorHint = '' }) => {
    setScanError('');
    setScanningImage(true);
    setLastScannedItem(null);

    try {
      const savedKey = localStorage.getItem('ecoserve_gemini_key') || '';
      const res = await fetch('/api/pantry/scan-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kitchenName: currentUser?.name || 'Govindas kitchen',
          imageDataUrl: jpegDataUrl,
          fileName,
          dominantColorHint,
          apiKeyFromClient: savedKey,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setScanError(data.error || 'Failed to scan image.');
      } else if (data.item) {
        setLastScannedItem(data.item);
        await fetchData();
      }
    } catch (err) {
      setScanError(err.message);
    }
    setScanningImage(false);
  };

  const captureFromWebcam = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopCamera();
    const { jpegDataUrl, dominantColorHint } = await normalizeImageToJpeg(rawDataUrl);
    await scanImage({ jpegDataUrl, fileName: 'webcam_capture.jpg', dominantColorHint });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fname = file.name;
    e.target.value = '';
    try {
      const { jpegDataUrl, dominantColorHint } = await normalizeImageToJpeg(file);
      await scanImage({ jpegDataUrl, fileName: fname, dominantColorHint });
    } catch {
      setScanError('Could not read image file.');
    }
  };

  const handleMovePantryToSurplus = async (id) => {
    await fetch(`/api/pantry/${id}/move-to-surplus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kitchenName: currentUser?.name || 'Govindas kitchen' }),
    });
    await fetchData();
    setActiveTab('my_batches');
  };

  const handleDeletePantryItem = async (id) => {
    await fetch(`/api/pantry/${id}`, { method: 'DELETE' });
    fetchData();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
        <h2 className="text-lg font-bold">📸 Scan Ingredient Photo (Auto-Expiry)</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl p-6 text-center cursor-pointer transition"
        >
          <div className="text-3xl mb-1">🖼️</div>
          <div className="text-sm font-bold text-emerald-800">
            Click to Upload Food / Ingredient Photo
          </div>
        </div>

        {!cameraActive ? (
          <button
            onClick={startCamera}
            className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
          >
            📷 Open Live Webcam
          </button>
        ) : (
          <div className="space-y-2">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-48 object-cover rounded-xl bg-black"
            />
            <div className="flex gap-2">
              <button
                onClick={captureFromWebcam}
                className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
              >
                📸 Capture & Scan
              </button>
              <button
                onClick={stopCamera}
                className="px-4 py-2 bg-slate-200 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {scanningImage && (
          <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
            ⏳ Analyzing image and detecting ingredients...
          </div>
        )}
        {scanError && (
          <div className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl">
            ❌ {scanError}
          </div>
        )}
        {lastScannedItem && (
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-emerald-900">
                ✅ Added: {lastScannedItem.item_name || lastScannedItem.ingredient_name}
              </span>
              {lastScannedItem.detection_source && (
                <span className="text-[10px] font-bold bg-white text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                  🤖 {lastScannedItem.detection_source}
                </span>
              )}
            </div>
            <div>
              Expires: <b>{lastScannedItem.expiry_date}</b> (
              {lastScannedItem.days_left ?? lastScannedItem.expiry_days} days)
            </div>
            <div className="text-slate-600">
              {lastScannedItem.ai_notes || lastScannedItem.storage_advice}
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">📦 Smart Pantry Inventory</h2>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
            👨‍🍳 {currentUser.name}
          </span>
        </div>

        {myPantryItems.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-1">
            <div className="text-2xl">📭</div>
            <div className="text-sm font-bold text-slate-700">
              No ingredients in {currentUser.name}&apos;s pantry yet
            </div>
            <div className="text-xs text-slate-500">
              Upload or scan a food photo on the left to add items to this kitchen&apos;s
              pantry!
            </div>
          </div>
        ) : (
          myPantryItems.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3"
            >
              <div>
                <div className="font-bold text-sm">
                  {item.item_name || item.ingredient_name}
                </div>
                <div className="text-xs text-slate-500">
                  {item.quantity} • Expires: <b>{item.expiry_date}</b> (
                  {item.days_left ?? item.expiry_days}d left)
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleMovePantryToSurplus(item.id)}
                  className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-semibold"
                >
                  ♻️ Donate to Surplus
                </button>
                <button
                  onClick={() => handleDeletePantryItem(item.id)}
                  className="text-xs text-slate-400 hover:text-red-600"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
