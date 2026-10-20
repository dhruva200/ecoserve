import React from 'react';

export default function AcceptFoodFeed({ currentUser, batches, fetchData }) {
  const handleClaimBatch = async (id) => {
    await fetch(`/api/batches/${id}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ngo_name: currentUser.name }),
    });
    fetchData();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {batches.map((batch) => (
        <div
          key={batch.id}
          className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between gap-3"
        >
          <div>
            {/* Clean Top Row (No Delete button for NGOs!) */}
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">
                📍 {batch.kitchen_name}
              </span>
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

          {/* When NGO Accepts a Batch, Show Their 4-Digit Pickup OTP Box Clearly */}
          {batch.status === 'Claimed' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
              <div className="text-xs text-blue-900">
                <div className="font-bold">🔑 Pickup OTP for Kitchen Handover</div>
                <div className="text-[11px] text-blue-700">
                  Share this 4-digit code with {batch.kitchen_name} at pickup
                </div>
              </div>
              <div className="bg-white border border-blue-300 text-blue-900 font-extrabold text-base tracking-widest px-3 py-1 rounded-lg">
                {batch.pickup_otp || '4829'}
              </div>
            </div>
          )}

          {/* Bottom Bar */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-emerald-700">
                🌱 Saves {batch.co2_saved_kg} kg CO₂e
              </span>
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
                  `🍱 *EcoServe Surplus Food Alert*\nKitchen: ${batch.kitchen_name}\nFood: ${batch.food_item}\nMeals: ${batch.servings} (${batch.quantity_kg} kg)`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-emerald-700 hover:underline"
              >
                💬 WhatsApp
              </a>
            </div>

            {batch.status === 'Available' && (
              <button
                onClick={() => handleClaimBatch(batch.id)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                🤝 Accept Food Batch
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
