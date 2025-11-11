import React from 'react';

export const DuesIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M13.5,8H10.5V6H13.5V8M13.5,18H10.5V16H13.5V18M11.5,10.22V13.78C12.53,13.64 13.5,13.23 13.5,12C13.5,10.77 12.53,10.36 11.5,10.22M19,4H5A2,2 0 0,0 3,6V18A2,2 0 0,0 5,20H19A2,2 0 0,0 21,18V6A2,2 0 0,0 19,4M16.5,15C15,16.5 12.83,17.5 10.5,17.5V6.5C12.83,6.5 15,7.5 16.5,9V15Z" />
  </svg>
);

export default DuesIcon;