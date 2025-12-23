import React from 'react';

export const F1FantasyLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 300 80" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <linearGradient id="red-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#FF0000" />
        <stop offset="100%" stopColor="#FF4D4D" />
      </linearGradient>
    </defs>
    <style>
      {`
        .formula-text { 
          font-family: 'Exo 2', sans-serif; 
          font-weight: 400;
          font-size: 16px;
          fill: #FFFFFF;
          letter-spacing: 0.5em;
          text-anchor: middle;
        }
        .fantasy-one-text { 
          font-family: 'Exo 2', sans-serif; 
          font-weight: 900;
          font-style: italic;
          font-size: 44px;
          fill: url(#red-grad);
          letter-spacing: -2px;
          text-anchor: middle;
        }
        .one-part {
          fill: #FFFFFF;
        }
      `}
    </style>
    <text x="150" y="45" className="fantasy-one-text">
      LIGHTS <tspan className="one-part">OUT</tspan>
    </text>
    <text x="150" y="70" className="formula-text">LEAGUE</text>
  </svg>
);