// Instant meal demand calculation so numbers react immediately when inputs change
export function computeLocalForecast({
  kitchenName,
  mealType,
  dayOfWeek,
  expectedStudents,
  weather,
}) {
  const headcount = Math.max(10, Number(expectedStudents) || 120);
  const weatherFactor = weather === 'Rainy' ? 0.78 : weather === 'Hot' ? 0.86 : 0.92;
  const dayFactor =
    dayOfWeek === 'Sunday'
      ? 0.75
      : dayOfWeek === 'Saturday'
      ? 0.8
      : dayOfWeek === 'Friday'
      ? 0.84
      : 0.93;
  const mealFactor =
    mealType === 'Breakfast' ? 0.85 : mealType === 'Dinner' ? 0.9 : 0.95;

  const predictedMeals = Math.max(
    5,
    Math.min(headcount - 2, Math.round(headcount * weatherFactor * dayFactor * mealFactor))
  );
  const mealsSavedFromWaste = Math.max(2, headcount - predictedMeals);

  return {
    predictedMeals,
    mealsSavedFromWaste,
    estimatedCostSavedINR: mealsSavedFromWaste * 120,
    aiAdvice: `For "${kitchenName}" on ${dayOfWeek} (${weather} ${mealType}) with ${headcount} registered diners, expected attendance is ~${Math.round(
      (predictedMeals / headcount) * 100
    )}%. Prepare ${predictedMeals} meals first and keep raw stock for ${mealsSavedFromWaste} meals in cold storage to save ₹${
      mealsSavedFromWaste * 120
    }.`,
  };
}
