import React, { useState } from 'react';

export default function PostedFoodStatus({ currentUser, batches, fetchData }) {
  const [otpInputs, setOtpInputs] = useState({});
  const [otpErrors, setOtpErrors] = useState({});
  const [filterMode, setFilterMode] = useState('all'); // 'mine' | 'all'

  const myKitchenName = (currentUser?.name || '').toLowerCase().trim();

  const isOwnedByMe = (batch) =>
    (batch.kitchen_name || '').toLowerCase().trim() === myKitchenName;

  const displayedBatches =
    filterMode === 'mine' ? batches.filter(isOwnedByMe) : batches;

  const handleOtpChange = (batchId, val) => {
    setOtpInputs((prev) => ({ ...prev, [batchId]: val }));
    setOtpErrors((prev) => ({ ...prev, [batchId]: '' }));
  };

  const handleVerifyPickup = async (batch) => {
    const expectedOtp = batch.pickup_otp || '4829';
    const entered = (otpInputs[batch.id] ?? '').trim();

    if (!entered) {
      setOtpErrors((prev) => ({
        ...prev,
        [batch.id]: `Please enter the 4-digit OTP from ${batch.claimed_by} (OTP: ${expectedOtp})`,
      }));
      return;
    }

    const res = await fetch(`/api/batches/${batch.id}/verify-pickup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp: entered }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      setOtpErrors((prev) => ({
        ...prev,
        [batch.id]: data.error || 'Incorrect OTP! Please check with the NGO.',
      }));
      return;
    }
    fetchData();
  };

  const handleDeleteBatch = async (batch) => {
    if (!isOwnedByMe(batch)) return;
    await fetch(
      `/api/batches/${batch.id}?kitchen=${encodeURIComponent(currentUser.name)}`,
      { method: 'DELETE' }
    );
    fetchData();
  };

  return (
    <div className="space-y-4">
      {/* Filter Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-3 rounded-2xl border border-slate-200">
        <div className="text-xs font-semibold text-slate-600">
          Logged in as <b className="text-slate-900">👨‍🍳 {currentUser?.name}</b> — You
          can only delete or verify batches posted by your own kitchen.
        </div>
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filterMode === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Network Batches ({batches.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('mine')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filterMode === 'mine'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            My Kitchen Posts ({batches.filter(isOwnedByMe).length})
          </button>
        </div>
      </div>

      {/* Food Batch Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayedBatches.map((batch) => {
          const isMine = isOwnedByMe(batch);
          const currentOtpVal = otpInputs[batch.id] ?? '';
          const errorText = otpErrors[batch.id];

          return (
            <div
              key={batch.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between gap-3"
            >
              <div>
                {/* Clean Top Row */}
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500">
                      📍 {batch.kitchen_name}
                    </span>
                    {isMine && (
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Your Post
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        batch.status === 'Available'
                          ? 'bg-emerald-100 text-emerald-800'
                          : batch.status === 'Delivered'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {batch.status === 'Available'
                        ? '🟢 Available'
                        : batch.status === 'Delivered'
                        ? `🎉 Delivered to ${batch.claimed_by}`
                        : `✅ Accepted by ${batch.claimed_by}`}
                    </span>

                    {/* Delete button ONLY appears if this batch belongs to the logged-in Kitchen! */}
                    {isMine && (
                      <button
                        onClick={() => handleDeleteBatch(batch)}
                        title="Delete your kitchen's post"
                        className="text-xs text-slate-400 hover:text-red-600 transition"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="text-base font-bold mt-1.5 text-slate-900">
                  {batch.food_item}
                </h3>
                <div className="text-xs text-slate-600 mt-1">
                  <b>{batch.servings} meals</b> ({batch.quantity_kg} kg) • Temp:{' '}
                  {batch.temperature_c ?? batch.storage_temp}°C • Expires in{' '}
                  {batch.expiry_hours}h
                </div>
              </div>

              {/* Simple & Clean Inline OTP Box (Only when an NGO has accepted YOUR kitchen's batch) */}
              {batch.status === 'Claimed' && isMine && (
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-900">
                      🔐 Enter NGO Pickup OTP to Confirm Handover
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleOtpChange(batch.id, batch.pickup_otp || '4829')
                      }
                      className="text-[11px] font-bold text-emerald-700 underline"
                    >
                      Auto-Fill OTP ({batch.pickup_otp || '4829'})
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="Enter 4-digit OTP"
                      value={currentOtpVal}
                      onChange={(e) => handleOtpChange(batch.id, e.target.value)}
                      className="w-36 border border-emerald-300 rounded-lg px-3 py-1.5 text-xs font-bold tracking-widest text-center bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleVerifyPickup(batch)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition"
                    >
                      ✅ Verify & Complete Delivery
                    </button>
                  </div>
                  {errorText && (
                    <div className="text-[11px] font-semibold text-red-600">
                      ❌ {errorText}
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Bar */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2 flex-wrap">
                <span className="text-xs font-semibold text-emerald-700">
                  🌱 Saves {batch.co2_saved_kg} kg CO₂e
                </span>

                <div className="flex items-center gap-3">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      batch.pickup_location || batch.kitchen_name
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    🗺️ Map
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `🍱 *EcoServe Surplus Food Alert*\nKitchen: ${batch.kitchen_name}\nFood: ${batch.food_item}\nMeals: ${batch.servings} (${batch.quantity_kg} kg)\nPickup Window: ${batch.expiry_hours}h`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-emerald-700 hover:underline"
                  >
                    💬 WhatsApp
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
