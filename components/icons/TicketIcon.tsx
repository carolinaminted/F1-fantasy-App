
import React from 'react';

export const TicketIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M9.1,5L11.5,2.6C11.9,2.2 12.5,2.2 12.9,2.6L19.4,9.1C19.8,9.5 19.8,10.1 19.4,10.5L17,12.9C17.4,13.3 17.4,13.9 17,14.3L14.3,17C13.9,17.4 13.3,17.4 12.9,17L10.5,19.4C10.1,19.8 9.5,19.8 9.1,19.4L2.6,12.9C2.2,12.5 2.2,11.9 2.6,11.5L5,9.1C4.6,8.7 4.6,8.1 5,7.7L7.7,5C8.1,4.6 8.7,4.6 9.1,5M11,6.4L10.4,7L13,9.6L13.6,9L11,6.4M15,10.4L14.4,11L17,13.6L17.6,13L15,10.4M7,10.4L6.4,11L9,13.6L9.6,13L7,10.4M11,14.4L10.4,15L13,17.6L13.6,17L11,14.4Z" />
  </svg>
);

export default TicketIcon;
