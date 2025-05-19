import React from 'react';

const steps = [
  "Introduced", 
  "Referred to Committee",
  "Passed House",
  "Received in Senate",
  "Passed Senate",
  "Enacted"
];

function BillProgress({ currentStatus, lastActionDate }) {
  const statusLC = currentStatus ? currentStatus.toLowerCase() : ""; // Handle potential null/undefined status

  // Determine the current step based on keywords, checking latest stages first
  let currentStepIndex = 0; // Default to Introduced

  if (statusLC.includes('became public law')) {
    currentStepIndex = 5; // Enacted
  } else if (statusLC.includes('passed senate') || statusLC.includes('agreed to in senate')) {
    // Specific Senate passage indicators
    currentStepIndex = 4; // Passed Senate
  } else if (statusLC.includes('message on') && (statusLC.includes('house action') || statusLC.includes('senate action'))) {
      // Messages often relate to amendments or resolving differences, typically post-passage in at least one chamber.
      // Place it after initial Senate passage but before Enacted. Could be step 4 or higher. Let's use 4.
      currentStepIndex = 4; // Post-Passage Activity / Conference Stage
  } else if (statusLC.includes('placed on senate legislative calendar') || statusLC.includes('placed on general orders calendar') ) {
    // Senate Calendars indicate readiness for Senate floor action (post-committee).
    currentStepIndex = 3; // Definitely in Senate, likely post-committee
  } else if (statusLC.includes('received in the senate')) {
    // Covers initial receipt and potential referral to Senate committee.
    currentStepIndex = 3; // Received in Senate
  } else if (statusLC.includes('passed house') || statusLC.includes('on passage passed') || (statusLC.includes('agreed to') && !statusLC.includes('senate'))) {
    // Specific House passage indicators. Filter 'agreed to' to exclude Senate context if possible.
    currentStepIndex = 2; // Passed House
  } else if (statusLC.includes('placed on the union calendar') || statusLC.includes('motion to reconsider laid on the table') || statusLC.includes('suspension of the rules')) {
    // Union Calendar = Ready for House Floor.
    // Motion to reconsider often immediately follows a vote to finalize it. Assume House if no Senate context found yet.
    // Suspension indicates expedited House floor procedure.
    // These suggest House floor action is imminent or just completed.
    // Place this check *after* specific 'passed house' but *before* 'referred to'.
     if (currentStepIndex < 2) { // Only update if we haven't already determined it passed House or Senate
        currentStepIndex = 2;
     }
  } else if (statusLC.includes('referred to') || statusLC.includes('subcommittee')) {
    // Committee/Subcommittee referral. This catches initial House referrals OR Senate referrals if 'Received in Senate' wasn't caught first.
    // Only set if we are still at the 'Introduced' stage.
    if (currentStepIndex < 1) {
       currentStepIndex = 1; // Referred to Committee
    }
     // Avoid downgrading if a Senate referral happens after step 3 was already detected.
     // The logic correctly checks later stages first, so this is less likely to be an issue.
  } else if (statusLC.includes('introduced') || statusLC.includes('sponsor introductory remarks')) {
    // Explicit introduction status. Only set if no other stage detected.
     if (currentStepIndex === 0) {
        currentStepIndex = 0; // Introduced
     }
  }

  return (
    <div className="border-t border-neutral-light pt-4">
      <h3 className="text-sm font-semibold uppercase text-neutral-medium mb-3">Bill Progress</h3>
      <div className="flex justify-between items-start">
        {steps.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;
          return (
            <div key={step} className="flex flex-col items-center text-center relative flex-1 px-1">
              {index > 0 && (
                <div
                  className={`absolute h-0.5 w-full left-[-50%] top-[11px] ${isCompleted || isActive ? 'bg-accent-green' : 'bg-neutral-light'}`}
                ></div>
              )}
              <div
                className={`z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center mb-2 ${
                  isActive || isCompleted
                    ? 'bg-accent-green border-accent-green text-white'
                    : 'border-neutral-light bg-white'
                }`}
              >
                {isActive || isCompleted ? '✓' : ''}
              </div>
              <div
                className={`text-xs ${
                  isActive
                    ? 'text-accent-green font-semibold'
                    : isCompleted
                    ? 'text-accent-green'
                    : 'text-neutral-medium'
                }`}
              >
                {step}
                {isActive ? (
                  <div className="text-xs">{lastActionDate}</div>
                ) : !isCompleted ? (
                  <div className="text-xs">TBD</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BillProgress;
