import React, { useState } from 'react';
import BillProgress from './BillProgress';
import ChatModal from './ChatModal';
import { ChatBubbleLeftEllipsisIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'; // Can probably switch this out

function BillDetails({ bill }) {
  const [isChatOpen, setIsChatOpen] = useState(false);

  if (!bill) {
    return <div className="text-center p-10 text-neutral-medium">Select a bill from the list to view details.</div>;
  }


  // Destructure directly from bill object
  const {
    meta: {
      identifier = 'N/A',
      congress = 'N/A',
      title = 'No Title Available',
      status = 'Status not available', // Use status for BillProgress
      introducedDate = 'N/A',
      // Ensure lastAction is always an object
      lastAction = { date: 'N/A', description: 'No recent action' },
    } = {}, // Default empty meta object
    textPlain = '',
    textHtml = ''
  } = bill || {}; // Default empty bill object

  // Use passed sponsor if available, otherwise fall back to bill's sponsor
  const sponsorInfo = bill?.meta?.sponsor || { name: 'N/A', party: 'N/A' };

  // Format date strings if they are valid dates
  const formatDate = (dateString) => {
    if (!dateString || dateString === 'N/A') return 'N/A';
    try {
      // Example formatting, adjust as needed
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      console.error('Failed to format date:', e);
      return dateString; // Return original if formatting fails

    }
  };

  const formattedIntroDate = formatDate(introducedDate);
  const formattedLastActionDate = formatDate(lastAction.date);
  console.log(status);


  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 bg-white rounded-lg shadow-sm border border-brand-red/10">

      {/* --- Bill Header --- */}
      <div>
        <span className="text-sm font-medium text-brand-red">{identifier} | {congress}</span>
        <h2 className="text-2xl font-bold text-gray-900 mt-1">{title}</h2>
        <div className="text-sm mt-2">
          Sponsored by: <span className={`font-medium ${sponsorInfo.party === 'Democratic' ? 'text-blue-600' : sponsorInfo.party === 'Republican' ? 'text-red-600' : 'text-gray-600'}`}>{sponsorInfo.name}</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">Introduced: {formattedIntroDate}</div>
      </div>

      {/* --- Bill Progress --- */}
      {/* Assuming BillProgress takes care of its own styling */}
      <BillProgress currentStatus={status} lastActionDate={formattedLastActionDate} />

      {/* --- Interact / Key Text Section --- */}
      {textPlain || textHtml ? (
        <div className="bg-gradient-to-r from-red-50 to-red-100 border border-brand-red/20 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Analyze Bill Text</h3>
          <p className="text-sm text-gray-600 mb-4">
            Use AI to understand this bill's content, ask questions, or get summaries based on the available text.
          </p>
          {/* --- Button to Open Chat --- */}
          <button
            onClick={() => setIsChatOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-brand-red text-white text-sm font-medium rounded-md shadow-sm hover:bg-brand-red-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-red transition duration-150 ease-in-out"
          >
            <ChatBubbleLeftEllipsisIcon className="h-5 w-5 mr-2" aria-hidden="true" />
            Ask AI about this Bill
          </button>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Bill Text Status</h3>
          <p className="text-sm text-gray-600">
            This bill currently has no associated text available. Text content will be added as it becomes available through the legislative process.
          </p>
        </div>
      )}

      {/* --- Chat Modal --- */}
      {isChatOpen && (
        <ChatModal
          billId={identifier}
          text={textPlain}
          html={textHtml}
          onClose={() => setIsChatOpen(false)}
        />
      )}

      {/* --- Last Action Section --- */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Latest Action</h3>
        <div className="flex items-start gap-3">
          <CalendarDaysIcon className="h-6 w-6 text-gray-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-gray-800">{formattedLastActionDate}</p>
            <p className="text-sm text-gray-600 mt-1">{lastAction.description}</p>
          </div>
        </div>
      </div>

       {/* --- Optional: Placeholder for Full Text / Links --- */}
       {/* <div className="border-t border-gray-200 pt-4 mt-6">
         <h3 className="text-lg font-semibold text-gray-700 mb-2">Full Text</h3>
         { Render links to text versions if available }
       </div> */}

    </div>
  );
}

export default BillDetails;