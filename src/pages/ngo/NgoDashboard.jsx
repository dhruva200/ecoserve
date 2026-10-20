import React from 'react';
import AcceptFoodFeed from './AcceptFoodFeed.jsx';
import ColdChainIoT from './ColdChainIoT.jsx';

export default function NgoDashboard({
  activeTab,
  currentUser,
  batches,
  iotLogs,
  fetchData,
  onDownloadCertificate,
}) {
  if (activeTab === 'iot') {
    return (
      <ColdChainIoT
        iotLogs={iotLogs}
        fetchData={fetchData}
        onDownloadCertificate={onDownloadCertificate}
      />
    );
  }

  return (
    <AcceptFoodFeed
      currentUser={currentUser}
      batches={batches}
      fetchData={fetchData}
    />
  );
}
