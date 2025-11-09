
import React from 'react';

export const DriverIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12C20,12.24 19.95,12.47 19.92,12.7L15,10V8H18V6H13V10L18.73,12.92C18.27,15.15 16.5,16.93 14.27,17.38L12.5,14.5H9.5L7.73,17.38C5.5,16.93 3.73,15.15 3.27,12.92L9,10V6H6V8H9V10L4.08,12.7C4.05,12.47 4,12.24 4,12A8,8 0 0,1 12,4Z"/>
  </svg>
);
