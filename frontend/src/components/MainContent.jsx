import React, { useRef, useState } from 'react';
import LeftColumn from './LeftColumn';
import RightColumn from './RightColumn';

// Simple throttle function
function throttle(fn, wait) {
  let lastTime = 0;
  let timeout;
  let lastArgs;
  return function (...args) {
    const now = Date.now();
    lastArgs = args;
    if (now - lastTime >= wait) {
      lastTime = now;
      fn(...args);
    } else {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        lastTime = Date.now();
        fn(...lastArgs);
      }, wait - (now - lastTime));
    }
  };
}

function MainContent({ results, selectedBillId, onSelectBill, selectedBill, isDetailLoading }) {
  // Slider state: percent width for left column
  const [leftWidth, setLeftWidth] = useState(40); // initial percent
  const dragging = useRef(false);
  const [isFocused, setIsFocused] = useState(false);

  // Throttled setLeftWidth
  const throttledSetLeftWidth = useRef(throttle(setLeftWidth, 40)); // ~25fps

  const handleMouseDown = () => {
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
  };
  const handleMouseUp = () => {
    dragging.current = false;
    document.body.style.cursor = '';
  };
  const handleMouseMove = (e) => {
    if (!dragging.current) return;
    const container = document.getElementById('split-container');
    const rect = container.getBoundingClientRect();
    let percent = ((e.clientX - rect.left) / rect.width) * 100;
    percent = Math.max(15, Math.min(85, percent)); // Clamp between 15% and 85%
    throttledSetLeftWidth.current(percent);
  };
  React.useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  });

  return (
    <div id="split-container" className="flex flex-grow gap-0 p-0 relative w-full h-full" style={{ minHeight: '0', minWidth: '0' }}>
      <div style={{ width: `${leftWidth}%`, minWidth: 0, height: '100%', transition: dragging.current ? 'none' : 'width 0.1s', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <LeftColumn
          results={results}
          selectedBillId={selectedBillId}
          onSelectBill={onSelectBill}
        />
      </div>
      {/* Divider/Slider Bar */}
      <div
        style={{
          width: 8,
          cursor: 'col-resize',
          background: dragging.current || isFocused ? '#60a5fa' : '#e5e7eb',
          zIndex: 10,
          transition: 'background 0.1s',
        }}
        className="hover:bg-brand-red-light active:bg-brand-red transition-colors duration-75"
        onMouseDown={handleMouseDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        role="separator"
        aria-orientation="vertical"
        tabIndex={0}
      ></div>
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', transition: dragging.current ? 'none' : 'width 0.1s', padding: '18px 18px 0 18px' }}>
        <RightColumn selectedBill={selectedBill} isDetailLoading={isDetailLoading} />
      </div>
    </div>
  );
}

export default MainContent;
