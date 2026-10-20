import React, { useState } from 'react';

export default function PostSurplusFood({ currentUser, fetchData, setActiveTab }) {
  const [batchForm, setBatchForm] = useState({
    kitchen_name: currentUser?.name || 'Govindas kitchen',
    pickup_location: `${currentUser?.name || 'Govindas kitchen'}, Mathura`,
    food_item: 'Rajma Chawal & Mixed Veg Trays',
    servings: 100,
    quantity_kg: 38,
    expiry_hours: 4,
  });
  const [postError, setPostError] = useState('');
  const [posting, setPosting] = useState(false);

  const handleDetectGps = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(
          5
        )}`;
        setBatchForm((prev) => ({ ...prev, pickup_location: coords }));
      },
      () => {
        setBatchForm((prev) => ({
          ...prev,
          pickup_location: `${prev.kitchen_name}, Mathura`,
        }));
      }
    );
  };

  const handlePostBatch = async (e) => {
    e.preventDefault();
    setPostError('');

    const cleanFood = (batchForm.food_item || '').trim();
    if (!cleanFood || cleanFood.length < 3) {
      setPostError('Please enter a valid Food Item Description (at least 3 characters).');
      return;
    }
    if (Number(batchForm.servings) < 1 || Number(batchForm.quantity_kg) <= 0) {
      setPostError('Servings and Weight (kg) must be greater than 0.');
      return;
    }

    setPosting(true);
    try {
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchForm),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setPostError(data.error || 'Could not post surplus food batch.');
        setPosting(false);
        return;
      }
      setBatchForm({ ...batchForm, food_item: '' });
      await fetchData();
      setActiveTab('my_batches');
    } catch (err) {
      setPostError(`Network Error: ${err.message}`);
    }
    setPosting(false);
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded-2xl border border-slate-200">
      <h2 className="text-lg font-bold mb-4">🍱 Post Surplus Food for NGOs</h2>

      {postError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-3 rounded-xl">
          ❌ {postError}
        </div>
      )}

      <form onSubmit={handlePostBatch} className="space-y-4 text-sm">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Kitchen Name
          </label>
          <input
            type="text"
            required
            value={batchForm.kitchen_name}
            onChange={(e) => setBatchForm({ ...batchForm, kitchen_name: e.target.value })}
            className="w-full border border-slate-300 rounded-xl px-3 py-2"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-600">
              Pickup Location / Google Maps Pin
            </label>
            <button
              type="button"
              onClick={handleDetectGps}
              className="text-[11px] font-bold text-emerald-700 hover:underline"
            >
              📍 Use Live GPS Location
            </button>
          </div>
          <input
            type="text"
            required
            value={batchForm.pickup_location || ''}
            onChange={(e) =>
              setBatchForm({ ...batchForm, pickup_location: e.target.value })
            }
            placeholder="e.g. Mathura Campus Mess Gate 1"
            className="w-full border border-slate-300 rounded-xl px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Food Item Description
          </label>
          <input
            type="text"
            required
            value={batchForm.food_item}
            onChange={(e) => setBatchForm({ ...batchForm, food_item: e.target.value })}
            className="w-full border border-slate-300 rounded-xl px-3 py-2"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Servings
            </label>
            <input
              type="number"
              min="1"
              required
              value={batchForm.servings}
              onChange={(e) =>
                setBatchForm({ ...batchForm, servings: Number(e.target.value) })
              }
              className="w-full border border-slate-300 rounded-xl px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Weight (kg)
            </label>
            <input
              type="number"
              min="1"
              required
              value={batchForm.quantity_kg}
              onChange={(e) =>
                setBatchForm({ ...batchForm, quantity_kg: Number(e.target.value) })
              }
              className="w-full border border-slate-300 rounded-xl px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Safe Hours
            </label>
            <input
              type="number"
              min="1"
              max="72"
              required
              value={batchForm.expiry_hours}
              onChange={(e) =>
                setBatchForm({ ...batchForm, expiry_hours: Number(e.target.value) })
              }
              className="w-full border border-slate-300 rounded-xl px-3 py-2"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={posting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl"
        >
          {posting ? 'Posting...' : '📢 Post Surplus & Alert NGOs'}
        </button>
      </form>
    </div>
  );
}
