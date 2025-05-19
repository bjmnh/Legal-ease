import React from 'react';

function Header({ searchQuery, onSearchQueryChange, onSubmitSearch, currentUser, onSignOut }) {
  return (
    <header className="bg-gradient-to-r from-brand-red to-brand-red-dark text-white p-3 flex items-center justify-between gap-4">
      {/* Left Section */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Placeholder for Logo */}
        <div className="w-6 h-6 bg-white rounded-full opacity-75"></div>
        <span className="font-bold text-lg whitespace-nowrap">Federal Legislation</span>
      </div>

      {/* Center Section (Search) */}
      <div className="flex-1 flex justify-center px-4">
        <div className="flex w-full max-w-lg">
          <input
            type="text"
            placeholder="Keyword Search (Health, AI, Transportation, etc.)"
            value={searchQuery}
            onChange={e => onSearchQueryChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSubmitSearch()}
            className="flex-grow px-3 py-1.5 rounded-l bg-white text-neutral-dark focus:outline-none focus:ring-2 focus:ring-accent-blue"
          />
          <button
            onClick={onSubmitSearch}
            className="px-4 py-1.5 bg-white text-neutral-dark rounded-r font-semibold hover:bg-neutral-bg-light"
          >
            Search
          </button>
        </div>
      </div>

      {/* Right Section (Actions) */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {currentUser && (
          <button
            onClick={onSignOut}
            className="px-3 py-1.5 bg-white text-neutral-dark rounded font-semibold hover:bg-neutral-bg-light"
          >
            Sign Out
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
