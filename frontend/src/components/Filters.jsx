import React, { useState, useRef } from 'react';
// useEffect import removed as the "Click Outside" hook is deleted

// Define available filter categories
const filters = [
  { id: 'congress', label: 'Congress', icon: '🏛️' },
  // { id: 'hasKeyText', label: 'Bill Text', icon: '📜' },
  { id: 'sponsors', label: 'Sponsors', icon: '👥' },
];

// Define specific options for the 'hasKeyText' filter
// const hasKeyTextOptions = [
//   { label: 'Has Bill Text', value: true },
//   { label: 'No Bill Text', value: false }
// ];

// Filters component receives current filter values, setter function, and the list of all bills
function Filters({ filterValues, setFilterValues, allBills }) {
  const [openFilterId, setOpenFilterId] = useState(null); // State to track which filter dropdown is open
  const [dropdownStyle, setDropdownStyle] = useState({}); // State for positioning the dropdown dynamically
  const filterButtonRefs = useRef({}); // Ref to store button elements for positioning

  // Helper function to get and store ref for each filter button
  const getButtonRef = (id) => (el) => {
    filterButtonRefs.current[id] = el;
  };

  // --- Generate unique filter options from the data ---
  // Ensure allBills is an array before mapping to prevent errors
  const billsToProcess = Array.isArray(allBills) ? allBills : [];

  // Extract unique Congress options
  const congressOptions = Array.from(new Set(billsToProcess.map(b => b.congress))).filter(Boolean);
  // Extract unique Sponsor options
  const sponsorOptions = Array.from(new Set(billsToProcess.map(b => b.sponsor?.name))).filter(Boolean);

  // Map filter IDs to their respective generated options
  const filterOptionMap = {
    congress: congressOptions.map(opt => ({ label: String(opt), value: opt })),
    // hasKeyText: hasKeyTextOptions,
    sponsors: sponsorOptions.map(opt => ({ label: opt, value: opt })),
  };

  // Toggle the visibility of a filter dropdown
  const toggleDropdown = (filterId) => {
    const currentlyOpen = openFilterId === filterId;
    if (currentlyOpen) {
      setOpenFilterId(null); // Close if already open
    } else {
      const buttonElement = filterButtonRefs.current[filterId];
      if (buttonElement) {
        // Calculate dropdown position based on the button's position
        const rect = buttonElement.getBoundingClientRect();
        setDropdownStyle({
          position: 'fixed', // Use fixed to position relative to the viewport
          top: `${rect.bottom + 4}px`,
          left: `${rect.left}px`,
          minWidth: `${rect.width < 192 ? 192 : rect.width}px`,
          zIndex: 50, // Ensure dropdown is above other content
        });
      }
      setOpenFilterId(filterId); // Open the selected filter
    }
  };

  // Handle selecting an option from a dropdown
  const handleSelect = (filterId, value) => {
    if (typeof setFilterValues === 'function') {
       // Update the filter value in the parent component's state
       setFilterValues(prev => ({ ...prev, [filterId]: value }));
    }
    setOpenFilterId(null); // Close dropdown after selection
  };

  // Handle clearing a single filter
  const handleClearFilter = (filterId) => {
    if (typeof setFilterValues === 'function') {
        // Set the filter value to its default empty state
        setFilterValues(prev => ({ ...prev, [filterId]: '' }));
    }
    setOpenFilterId(null); // Close dropdown after clearing
  };

  // Handle clearing all filters
  const clearFilters = () => {
    setFilterValues({ congress: '', sponsors: '' }); // Reset all filters
    setOpenFilterId(null); // Close any open dropdown
  };

  // Calculate how many filters are currently active (value is not '')
  const activeFilterCount = Object.values(filterValues).filter(val => val !== '').length;

  return (
    <div className="mb-2">
      {/* Filter buttons container (allows horizontal scrolling) */}
      <div className="flex flex-nowrap gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pb-1 items-center relative" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* "FILTERS" label button */}
        <button className="bg-neutral-bg-light border border-neutral-light text-neutral-dark px-3 py-1 rounded text-xs font-medium flex items-center gap-2 hover:bg-neutral-bg-medium min-w-[90px] max-w-xs truncate flex-shrink-0">
          FILTERS <span className="bg-neutral-medium text-white text-[9px] rounded-full px-1 py-0 h-4 flex items-center justify-center leading-none ml-1">{activeFilterCount}</span>
        </button>

        {/* Render filter buttons */}
        {filters.map(filter => (
          <div key={filter.id} className="min-w-max flex-shrink-0">
            <button
              ref={getButtonRef(filter.id)} // Attach ref for positioning
              onClick={() => toggleDropdown(filter.id)} // Toggle dropdown on click
              className={`bg-neutral-bg-light border border-neutral-light text-neutral-dark px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5 hover:bg-neutral-bg-medium min-w-max
                ${filterValues[filter.id] !== '' ? 'bg-neutral-bg-medium text-white' : ''} {/* Active state style */}
                ${openFilterId === filter.id ? '!bg-neutral-bg-dark !text-white' : ''} {/* Open state style */}
              `}
              style={{ minWidth: 0 }} // Allow button to shrink
            >
              <span className="opacity-75">{filter.icon}</span>
              {filter.label}
              <span className="ml-auto pl-1 opacity-75">▼</span> {/* Dropdown indicator */}
            </button>
          </div>
        ))}

        {/* "Clear All" button - appears only if filters are active */}
        {activeFilterCount > 0 && (
          <button aria-label="Clear all filters" className="ml-2 text-neutral-medium hover:text-red-500 text-xs flex items-center justify-center border border-transparent rounded-full w-5 h-5 flex-shrink-0" style={{ minWidth: 'unset', padding: 0 }} onClick={clearFilters}>
            <span style={{fontWeight:'bold',fontSize:'16px',lineHeight:'1'}}>×</span>
          </button>
        )}
      </div>

      {/* Dropdown menu - Renders conditionally when a filter button is clicked */}
      {/* Check if a filter is open AND if there are options for it */}
      {openFilterId && filterOptionMap[openFilterId] && (
        <div
          style={dropdownStyle} // Apply dynamic style for fixed positioning
          className="bg-white border border-neutral-light rounded shadow-lg p-2 max-h-60 overflow-y-auto w-48 z-50"
        >
          {/* Render options if the list is not empty */}
          {filterOptionMap[openFilterId].length > 0 ? (
            <ul>
              {/* Map through filter options */}
              {filterOptionMap[openFilterId].map(option => (
                <li key={String(option.value)}> {/* Use value as key, ensuring it's a string */}
                  <button
                    className={`w-full text-left px-2 py-1 rounded text-xs hover:bg-brand-red hover:text-white ${
                      filterValues[openFilterId] === option.value ? 'bg-brand-red text-white' : ''
                    }`}
                    onClick={() => handleSelect(openFilterId, option.value)} // Call handler on click
                  >
                    {option.label}
                  </button>
                </li>
              ))}
              {/* "Clear selection" button inside dropdown - appears if the current filter has a value */}
              {filterValues[openFilterId] !== '' && (
                 <li>
                   <button
                     className="w-full text-left px-2 py-1 rounded text-xs text-neutral-medium hover:bg-gray-100 mt-1"
                     onClick={() => handleClearFilter(openFilterId)} // Call handler on click
                   >
                     Clear selection
                   </button>
                 </li>
              )}
            </ul>
          ) : (
            // Message displayed if no options are available for the selected filter
            <p className="text-xs text-neutral-dark p-2">No options for {filters.find(f => f.id === openFilterId)?.label}.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default Filters;