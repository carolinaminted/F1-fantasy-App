// Fix: Implement the LeaderboardIcon component.
import React from 'react';

export const LeaderboardIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M10,20H14V4H10V20M4,20H8V12H4V20M16,20H20V9H16V20Z" />
  </svg>
);
