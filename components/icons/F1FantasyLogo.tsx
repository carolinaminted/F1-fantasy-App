import React from 'react';

export const F1FantasyLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 300 80" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <linearGradient id="red-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#DA291C" />
        <stop offset="100%" stopColor="#FF3C28" />
      </linearGradient>
    </defs>
    <style>
      {`
        .formula-text { 
          font-family: 'Exo 2', sans-serif; 
          font-weight: 400;
          font-size: 18px;
          fill: #F5F5F5;
          letter-spacing: 0.3em;
          text-anchor: middle;
        }
        .fantasy-one-text { 
          font-family: 'Exo 2', sans-serif; 
          font-weight: 900;
          font-style: italic;
          font-size: 48px;
          fill: url(#red-grad);
          letter-spacing: -2px;
          text-anchor: middle;
        }
        .one-part {
          fill: #F5F5F5;
        }
      `}
    </style>
    <text x="150" y="25" className="formula-text">FORMULA</text>
    <text x="150" y="70" className="fantasy-one-text">
      FANTASY <tspan className="one-part">ONE</tspan>
    </text>
  </svg>
);
