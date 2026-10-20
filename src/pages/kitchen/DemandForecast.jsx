import React, { useState } from 'react';

export default function DemandForecast({ currentUser }) {
  const [forecastForm, setForecastForm] = useState({
    kitchenName: currentUser?.name || 'Govindas kitchen',
    mealType: 'Lunch',
    dayOfWeek: 'Tuesday',
    expectedStudents: 108,
    weather: 'Sunny',
  });

  // Forecast result ONLY updates when the user explicitly clicks "Predict Meal Demand"
  const [forecastResult, setForecastResult] = useState(null);
  const [inputsChangedSinceLastRun, setInputsChangedSinceLastRun] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [forecastError, setForecastError] = useState('');

  // Changing inputs NEVER auto-predicts; user must click the Predict button
  const updateForecastField = (field, value) => {
    setForecastForm((prev) => ({ ...prev, [field]: value }));
    setForecastError('');
    if (forecastResult) {
      setInputsChangedSinceLastRun(true);
    }
  };

  const handleRunForecast = async (e) => {
    if (e) e.preventDefault();
    setForecastError('');

    const cleanKitchen = String(forecastForm.kitchenName || '').trim();
    if (!cleanKitchen || cleanKitchen.length < 2) {
      setForecastError('Please enter a valid Kitchen Name (at least 2 characters).');
      return;
    }

    const headcount = Number(forecastForm.expectedStudents);
    if (!Number.isFinite(headcount) || headcount < 5 || headcount > 50000) {
      setForecastError(
        'Please enter a valid Registered Headcount between 5 and 50,000 diners.'
      );
      return;
    }

    setLoadingAI(true);

    try {
      const savedKey = localStorage.getItem('ecoserve_gemini_key') || '';
      const res = await fetch('/api/ai-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...forecastForm,
          expectedStudents: headcount,
          apiKeyFromClient: savedKey,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setForecastError(
          data.error || 'Failed to generate AI forecast. Please check your API key.'
        );
        setLoadingAI(false);
        return;
      }

      setForecastResult({
        source: data.source || `Google Gemini AI (${data.modelUsed || 'Live'})`,
        kitchenName: data.kitchenName || cleanKitchen,
        dayOfWeek: data.dayOfWeek || forecastForm.dayOfWeek,
        weather: data.weather || forecastForm.weather,
        mealType: data.mealType || forecastForm.mealType,
        headcount: data.headcount || headcount,
        predictedMeals: Number(data.predictedMeals),
        mealsSavedFromWaste: Number(data.mealsSavedFromWaste),
        estimatedCostSavedINR: Number(data.estimatedCostSavedINR),
        aiAdvice: data.aiAdvice,
      });
      setInputsChangedSinceLastRun(false);
    } catch (err) {
      setForecastError(
        `Network Error: Unable to reach server (${err.message || 'Check backend'}).`
      );
    }
    setLoadingAI(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <h2 className="text-lg font-bold mb-4">
          🔮 Institutional Meal Demand Forecaster
        </h2>

        {forecastError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-3 rounded-xl">
            ❌ {forecastError}
          </div>
        )}

        <form onSubmit={handleRunForecast} className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Kitchen Name
            </label>
            <input
              type="text"
              required
              value={forecastForm.kitchenName}
              onChange={(e) => updateForecastField('kitchenName', e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Day of Week
              </label>
              <select
                value={forecastForm.dayOfWeek}
                onChange={(e) => updateForecastField('dayOfWeek', e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white"
              >
                {[
                  'Monday',
                  'Tuesday',
                  'Wednesday',
                  'Thursday',
                  'Friday',
                  'Saturday',
                  'Sunday',
                ].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Weather
              </label>
              <select
                value={forecastForm.weather}
                onChange={(e) => updateForecastField('weather', e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white"
              >
                <option>Sunny</option>
                <option>Rainy</option>
                <option>Hot</option>
                <option>Pleasant</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Meal Session
              </label>
              <select
                value={forecastForm.mealType}
                onChange={(e) => updateForecastField('mealType', e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white"
              >
                <option>Breakfast</option>
                <option>Lunch</option>
                <option>Dinner</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Registered Headcount
              </label>
              <input
                type="number"
                min="5"
                max="50000"
                required
                value={forecastForm.expectedStudents}
                onChange={(e) =>
                  updateForecastField('expectedStudents', e.target.value)
                }
                className="w-full border border-slate-300 rounded-xl px-3 py-2"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loadingAI}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition"
          >
            {loadingAI
              ? '⏳ Asking Google Gemini AI...'
              : '✨ Predict Meal Demand'}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
        {!forecastResult ? (
          <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
            <div className="text-3xl">🔮</div>
            <div className="text-sm font-extrabold text-slate-800">
              Ready for Live AI Prediction
            </div>
            <p className="text-xs text-slate-500 max-w-sm">
              Enter your <b>Day, Weather, Meal Session</b> and{' '}
              <b>Registered Headcount</b> on the left, then click{' '}
              <b>&ldquo;✨ Predict Meal Demand&rdquo;</b> to run a live AI forecast.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase text-emerald-700">
                AI Forecast for {forecastResult.kitchenName} (
                {forecastResult.headcount} Diners • {forecastResult.dayOfWeek} •{' '}
                {forecastResult.weather} • {forecastResult.mealType})
              </div>
              <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                ✅ {forecastResult.source}
              </span>
            </div>

            {inputsChangedSinceLastRun && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-3 py-2 rounded-xl">
                ⚠️ You changed the inputs on the left. Click{' '}
                <b>&ldquo;✨ Predict Meal Demand&rdquo;</b> to calculate the new
                forecast!
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-50 p-3.5 rounded-xl border">
                <div className="text-xs text-slate-500">Recommended Prep</div>
                <div className="text-2xl font-extrabold mt-1">
                  {forecastResult.predictedMeals}
                </div>
              </div>
              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                <div className="text-xs text-emerald-700">Waste Prevented</div>
                <div className="text-2xl font-extrabold text-emerald-600 mt-1">
                  {forecastResult.mealsSavedFromWaste}
                </div>
              </div>
              <div className="bg-purple-50 p-3.5 rounded-xl border border-purple-200">
                <div className="text-xs text-purple-700">Cost Saved</div>
                <div className="text-2xl font-extrabold text-purple-700 mt-1">
                  ₹{forecastResult.estimatedCostSavedINR}
                </div>
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border text-sm text-slate-700">
              <b>🤖 AI Prep Advice:</b> {forecastResult.aiAdvice}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
