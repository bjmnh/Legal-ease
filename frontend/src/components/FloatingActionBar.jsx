import React from 'react';

// const actions = [
//   // { id: 'notes', icon: '📝', title: 'Notes, Tags & Position' },
//   // { id: 'alert', icon: '🔔', title: 'Create Alert' },
// ];

function FloatingActionBar() {
  return (
    <aside className="fixed right-4 top-1/2 -translate-y-1/2 z-20">
      {/* <div className="flex flex-col gap-3 bg-brand-purple/80 backdrop-blur-sm p-2 rounded-md shadow-lg">
        {actions.map(action => (
          <button
            key={action.id}
            title={action.title}
            className="bg-brand-purple hover:bg-brand-purple-dark text-white w-9 h-9 rounded flex items-center justify-center text-lg shadow"
          >
            {action.icon}
          </button>
        ))}
      </div> */}
    </aside>
  );
}

export default FloatingActionBar;
