import React from 'react';

export const TrophyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M12,2A9,9 0 0,1 21,11C21,14.04 19.5,16.81 17.14,18.5C17.14,18.5 17.14,18.5 17.13,18.51L17,18.61C16.5,19.12 16,19.5 15.5,19.75L14,20.5V22H10V20.5L8.5,19.75C8,19.5 7.5,19.12 7,18.61L6.87,18.5C4.5,16.81 3,14.04 3,11A9,9 0 0,1 12,2M12,4A7,7 0 0,0 5,11C5,13.38 6.1,15.5 7.8,16.8L9,15.8V11H15V15.8L16.2,16.8C17.9,15.5 19,13.38 19,11A7,7 0 0,0 12,4M11,12H13V14H11V12Z" />
  </svg>
);

export default TrophyIcon;