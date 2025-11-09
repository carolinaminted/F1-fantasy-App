import React from 'react';

export const F1FantasyLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg" {...props}>
    <style>
      {`
        .f1-text { 
          font-family: 'Exo 2', sans-serif; 
          font-weight: 900; 
          font-style: italic; 
          font-size: 48px; 
          fill: #ff8400; 
        }
        .fantasy-text { 
          font-family: 'Exo 2', sans-serif; 
          font-weight: 600; 
          font-size: 16px; 
          letter-spacing: 2.5px; 
          fill: #ffffff; 
        }
      `}
    </style>
    <text x="0" y="40" className="f1-text">F1</text>
    <text x="55" y="36" className="fantasy-text">FANTASY</text>
  </svg>
);