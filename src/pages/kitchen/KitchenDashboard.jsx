import React from 'react';
import PantryScanner from './PantryScanner.jsx';
import DemandForecast from './DemandForecast.jsx';
import PostSurplusFood from './PostSurplusFood.jsx';
import PostedFoodStatus from './PostedFoodStatus.jsx';

export default function KitchenDashboard({
  activeTab,
  setActiveTab,
  currentUser,
  myPantryItems,
  batches,
  fetchData,
}) {
  if (activeTab === 'forecast') {
    return <DemandForecast currentUser={currentUser} />;
  }

  if (activeTab === 'post') {
    return (
      <PostSurplusFood
        currentUser={currentUser}
        fetchData={fetchData}
        setActiveTab={setActiveTab}
      />
    );
  }

  if (activeTab === 'my_batches') {
    return (
      <PostedFoodStatus
        currentUser={currentUser}
        batches={batches}
        fetchData={fetchData}
      />
    );
  }

  return (
    <PantryScanner
      currentUser={currentUser}
      myPantryItems={myPantryItems}
      fetchData={fetchData}
      setActiveTab={setActiveTab}
    />
  );
}
