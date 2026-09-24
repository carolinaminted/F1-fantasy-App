import React from 'react';

export const SurvivalIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M9 7h6v14H9zM2 12h6v9H2zM16 14h6v7h-6z" />
    <path d="M12 1.5l.9 1.8 2 .3-1.45 1.4.35 2L12 6.05 10.2 7l.35-2L9.1 3.6l2-.3z" />
  </svg>
);

export default SurvivalIcon;
