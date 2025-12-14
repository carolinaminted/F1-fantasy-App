
import React from 'react';

export const CheckeredFlagIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    {/* Thinner Flag Pole */}
    <path d="M4 2h1.5v20H4z" />
    
    {/* Waving Checkered Pattern - Row 1 (Top) */}
    <path d="M5.5 4L9.5 3v3.3L5.5 7.3z" />
    <path d="M13.5 4l4 1v3.3l-4-1z" />
    
    {/* Waving Checkered Pattern - Row 2 (Middle) */}
    <path d="M9.5 6.3l4 1v3.3l-4-1z" />
    <path d="M17.5 8.3l4-1v3.3l-4 1z" />
    
    {/* Waving Checkered Pattern - Row 3 (Bottom) */}
    <path d="M5.5 10.6l4-1v3.4l-4 1z" />
    <path d="M13.5 10.6l4 1v3.4l-4-1z" />
    
    {/* Flag Outline for definition */}
    <path 
      d="M5.5 4 L9.5 3 L13.5 4 L17.5 5 L21.5 4 V14 L17.5 15 L13.5 14 L9.5 13 L5.5 14 Z" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="0.5"
    />
  </svg>
);

export default CheckeredFlagIcon;
