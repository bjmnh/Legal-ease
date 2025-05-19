import React from 'react';
import BillDetails from './BillDetails';

function RightColumn({ selectedBill, isDetailLoading }) {
  return (
    <div className="flex flex-col max-h-[calc(100vh-64px)] gap-1 pt-1 px-2 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto pr-2">
        {isDetailLoading ? (
          <div className="text-center p-10 text-neutral-medium">Loading bill details...</div>
        ) : (
          <BillDetails bill={selectedBill} />
        )}
      </div>
    </div>
  );
}

export default RightColumn;
