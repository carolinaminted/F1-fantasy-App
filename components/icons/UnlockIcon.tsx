import React from 'react';

export const UnlockIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M18,8H17V6A5,5,0,0,0,12,1A5,5,0,0,0,7,6V8H6A2,2,0,0,0,4,10V20A2,2,0,0,0,6,22H18A2,2,0,0,0,20,20V10A2,2,0,0,0,18,8M12,17A2,2,0,0,1,10,15A2,2,0,0,1,12,13A2,2,0,0,1,14,15A2,2,0,0,1,12,17M15,8H9V6A3,3,0,0,1,12,3A3,3,0,0,1,15,6V8Z" />
  </svg>
);

export default UnlockIcon;