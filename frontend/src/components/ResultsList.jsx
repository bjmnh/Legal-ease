import React from 'react';
import ResultItem from './ResultItem';

function ResultsList({ results = [], selectedBillId, onSelectBill, sortBy, setSortBy }) {
  const isLoading = false; // Toggle to test loading state

  if (isLoading) {
    return (
      <div className="text-center p-10 text-neutral-medium">Loading More Results...</div>
    );
  }

  return (
    <div className="border rounded overflow-hidden flex flex-col h-full">
      {/* Results Summary Row */}
      <div className="p-2 border-b border-neutral-light flex items-center gap-2 text-xs bg-gray-50 min-h-[32px]">
        <span>{results.length || '16,064'} Results</span>
        <span className="text-neutral-medium">Sort</span>
        <select
          className="ml-1 bg-neutral-bg-light border border-neutral-light rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-purple min-w-[80px]"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          <option value="best">Best Match</option>
          <option value="alphabetical">Alphabetical</option>
          <option value="date">Date Introduced</option>
        </select>
      </div>

      {/* List Area */}
      <ul className="divide-y divide-neutral-light flex-1 overflow-y-auto max-h-none">
        {results.map(bill => (
          <ResultItem
            key={bill.id}
            bill={bill}
            isSelected={bill.id === selectedBillId}
            onSelect={onSelectBill}
          />
        ))}
      </ul>
    </div>
  );
}

export default ResultsList;
