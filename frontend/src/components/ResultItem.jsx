import React from 'react';

function ResultItem({ bill = {}, isSelected, onSelect }) {
  const {
    id = 'N/A',
    identifier = 'N/A',
    introducedDate = 'N/A',
    congress = 'N/A',
    hasKeyText = false,
    title = 'No Title Available',
    sponsor = { name: 'N/A', party: 'N/A', dems: 0, reps: 0 },
    lastAction = { date: 'N/A', description: 'No recent action' }
  } = bill;

  const sponsorText = `${sponsor.name || 'N/A'}`;
  const cosponsorCount = (sponsor.dems || 0) + (sponsor.reps || 0);

  return (
    <li
      className={`p-3 flex gap-3 cursor-pointer ${isSelected ? 'bg-brand-red-light border border-brand-red -m-px' : 'hover:bg-neutral-bg-light'}`}
      
      onClick={() => onSelect(id)}
    >
      <input
        type="checkbox"
        checked={isSelected}
        readOnly
        className="mt-1 form-checkbox h-4 w-4 text-brand-red rounded border-neutral-light focus:ring-brand-red flex-shrink-0"
      />
      <div className="flex flex-col gap-1 w-full">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="font-semibold text-neutral-dark">{identifier}</span>
          <span className="text-neutral-medium">Introduced {introducedDate} | {congress}</span>
          {hasKeyText && <span className="bg-accent-teal text-white text-xs font-bold px-2 py-0.5 rounded-full">KeyText</span>}
        </div>
        <h3 className="font-bold text-base text-neutral-dark">{title}</h3>
        <div className="text-sm">
          <span className={`font-medium ${sponsor.party === 'Democratic' ? 'text-blue-600' : sponsor.party === 'Republican' ? 'text-red-600' : 'text-neutral-dark'}`}>{sponsorText}</span>
          {cosponsorCount > 0 && <span className="text-neutral-medium"> + {cosponsorCount} Co-sponsors</span>}
        </div>
        <div className="text-xs mt-1">
          <span className="text-neutral-medium font-semibold uppercase mr-2">Last Action</span>
          <span className="text-neutral-medium mr-2">{lastAction.date}</span>
          <span className="text-neutral-dark block sm:inline">{lastAction.description}</span>
        </div>
      </div>
    </li>
  );
}

export default ResultItem;
