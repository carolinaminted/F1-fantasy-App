import React from 'react';

export const LockIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M12,17C10.89,17 10,16.1 10,15C10,13.89 10.89,13 12,13A2,2 0 0,1 14,15A2,2 0 0,1 12,17M18,8V6A6,6 0 0,0 6,6V8H4V20H20V8H18M8,6A4,4 0 0,1 16,6V8H8V6Z" />
  </svg>
);
