// Fix: Implement the PicksIcon component.
import React from 'react';

export const PicksIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M11.5,18L9.5,16L8.09,17.41L11.5,20.84L15.91,16.41L14.5,15L11.5,18Z" />
  </svg>
);
