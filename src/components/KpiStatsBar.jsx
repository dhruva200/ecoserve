import React from 'react';

export default function KpiStatsBar({
  pantryCount,
  availableMeals,
  totalCo2,
  latestTemp,
}) {
  const isHighTemp = Number(latestTemp) > 7.0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <div className="text-xs text-slate-400 font-bold uppercase">Pantry Items</div>
        <div className="text-2xl font-extrabold mt-1">{pantryCount} Ingredients</div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <div className="text-xs text-slate-400 font-bold uppercase">Available Meals</div>
        <div className="text-2xl font-extrabold text-emerald-600 mt-1">
          {availableMeals} Meals
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <div className="text-xs text-slate-400 font-bold uppercase">CO₂e Saved</div>
        <div className="text-2xl font-extrabold mt-1">{totalCo2} kg CO₂e</div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <div className="text-xs text-slate-400 font-bold uppercase">Freezer Temp</div>
        <div
          className={`text-2xl font-extrabold mt-1 ${
            isHighTemp ? 'text-red-600' : 'text-blue-600'
          }`}
        >
          {latestTemp}°C {isHighTemp ? '⚠️ High' : '✅ Optimal'}
        </div>
      </div>
    </div>
  );
}
