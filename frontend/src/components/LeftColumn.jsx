import React, { useState, useMemo } from 'react';
import Filters from './Filters';
import ResultsList from './ResultsList';

function LeftColumn({ results, selectedBillId, onSelectBill }) {
  // Flatten the array of arrays into a single array of bill objects
  const allBills = useMemo(() => results.flat(), [results]);

  // Filter state: '' = off, true = has text, false = no text
  const [filterValues, setFilterValues] = useState({
    congress: '',
    // hasKeyText: '',
    sponsors: '',
  });

  // Sort state
  const [sortBy, setSortBy] = useState('best');

  // Filter the bills based on filterValues
  const filteredResults = useMemo(() => {
      return allBills.filter(bill => {
        // Congress filter
        if (filterValues.congress && bill.congress !== filterValues.congress) {
          return false;
        }

        // Sponsors filter
        if (filterValues.sponsors && (bill.sponsor?.name ?? '') !== filterValues.sponsors) {
          return false;
        }

        // hasKeyText filter
        // console.log(`Checking bill ${bill.id}: hasKeyText=${bill.hasKeyText}, filter=${filterValues.hasKeyText}`); // Log bill value and filter value
        // if (filterValues.hasKeyText !== '' && bill.hasKeyText !== filterValues.hasKeyText) {
        //   // If filter is active (not empty string) AND bill's hasKeyText does NOT match the filter value...
        //   // console.log(`Excluding bill ${bill.id}`); // Log if excluded
        //   // return false; // ...exclude the bill
        // }
        // // If filter is inactive, or bill's hasKeyText matches the filter value, include the bill (so far)
        // // console.log(`Including bill ${bill.id}`); // Log if included (at this stage)
        // // return true; // Bill passes this filter
        return true; // Bill passes this filter
      });
  }, [allBills, filterValues]); // Re-run filter when allBills or filterValues change

  // Sort the filtered results
  const sortedResults = useMemo(() => {
      const sortableResults = [...filteredResults];

      sortableResults.sort((a, b) => {
        if (sortBy === 'alphabetical') {
          const titleA = a.title || '';
          const titleB = b.title || '';
          return titleA.localeCompare(titleB);
        } else if (sortBy === 'date') {
          // Use 'introducedDate' field
          const dateA = new Date(a.introducedDate || 0);
          const dateB = new Date(b.introducedDate || 0);
          return dateB.getTime() - dateA.getTime(); // Sort descending
        }
        // Default/best match sort
        return 0;
      });
      return sortableResults;
  }, [filteredResults, sortBy]); // Dependencies: re-sort if filteredResults or sortBy change


  return (
    <div className="flex flex-col max-h-[calc(100vh-64px)] gap-1 pt-1 px-2 overflow-hidden">
      {/* Pass all bills to Filters for option generation */}
      <Filters allBills={allBills} filterValues={filterValues} setFilterValues={setFilterValues} />

      <div className="flex-1 min-h-0 overflow-y-auto"> {/* Scroll container for results */}
        <ResultsList
          results={sortedResults}
          selectedBillId={selectedBillId}
          onSelectBill={onSelectBill}
          sortBy={sortBy}
          setSortBy={setSortBy}
        />
      </div>
    </div>
  );
}

export default LeftColumn;