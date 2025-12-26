import React, { useState, useEffect, useCallback } from 'react';

interface CountdownTimerProps {
  targetDate: string;
  className?: string;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate, className = '' }) => {
  const calculateTimeLeft = useCallback(() => {
    const difference = +new Date(targetDate) - +new Date();
    let timeLeft = {};

    if (difference > 0) {
      timeLeft = {
        d: Math.floor(difference / (1000 * 60 * 60 * 24)),
        h: Math.floor((difference / (1000 * 60 * 60)) % 24),
        m: Math.floor((difference / 1000 / 60) % 60),
        s: Math.floor((difference / 1000) % 60),
      };
    }
    return timeLeft;
  }, [targetDate]);

  const [timeLeft, setTimeLeft] = useState<{ d?: number; h?: number; m?: number; s?: number }>(calculateTimeLeft());

  useEffect(() => {
    // Initialize immediately
    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeLeft]);

  const formatUnit = (unit: number | undefined) => {
      return (unit || 0).toString().padStart(2, '0');
  };

  if (Object.keys(timeLeft).length === 0) {
    return <span className={`text-primary-red font-bold ${className}`}>LOCKED</span>;
  }

  return (
    <div className={`flex items-center gap-2 font-mono ${className}`}>
        <div className="flex flex-col items-center">
            <span className="text-xl md:text-2xl font-bold text-pure-white leading-none">{formatUnit(timeLeft.d)}</span>
            <span className="text-[9px] text-highlight-silver uppercase tracking-wider">Days</span>
        </div>
        <span className="text-primary-red font-bold text-xl mb-3">:</span>
        <div className="flex flex-col items-center">
            <span className="text-xl md:text-2xl font-bold text-pure-white leading-none">{formatUnit(timeLeft.h)}</span>
            <span className="text-[9px] text-highlight-silver uppercase tracking-wider">Hrs</span>
        </div>
        <span className="text-primary-red font-bold text-xl mb-3">:</span>
        <div className="flex flex-col items-center">
            <span className="text-xl md:text-2xl font-bold text-pure-white leading-none">{formatUnit(timeLeft.m)}</span>
            <span className="text-[9px] text-highlight-silver uppercase tracking-wider">Min</span>
        </div>
        <span className="text-primary-red font-bold text-xl mb-3 hidden sm:inline">:</span>
        <div className="flex flex-col items-center hidden sm:flex">
            <span className="text-xl md:text-2xl font-bold text-pure-white leading-none">{formatUnit(timeLeft.s)}</span>
            <span className="text-[9px] text-highlight-silver uppercase tracking-wider">Sec</span>
        </div>
    </div>
  );
};

export default CountdownTimer;