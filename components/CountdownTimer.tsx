
import React, { useState, useEffect, useCallback } from 'react';
import { LockIcon } from './icons/LockIcon.tsx';

interface CountdownTimerProps {
  targetDate: string;
  onExpire?: () => void;
  className?: string;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate, onExpire, className = '' }) => {
  const calculateTimeLeft = useCallback(() => {
    if (!targetDate) return {};
    
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
    return { difference, timeLeft };
  }, [targetDate]);

  const [state, setState] = useState(() => calculateTimeLeft());
  const [hasExpired, setHasExpired] = useState(false);

  useEffect(() => {
    // Initial check
    const { difference } = calculateTimeLeft();
    if (difference !== undefined && difference <= 0) {
        setHasExpired(true);
        return;
    }

    const timer = setInterval(() => {
      const newState = calculateTimeLeft();
      setState(newState);

      if (newState.difference !== undefined && newState.difference <= 0) {
        setHasExpired(true);
        clearInterval(timer);
        if (onExpire) onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeLeft, onExpire]);

  const formatUnit = (unit: number | undefined) => {
      return (unit || 0).toString().padStart(2, '0');
  };

  if (!targetDate) return null;

  if (hasExpired) {
    return (
        <div className={`flex items-center gap-2 text-primary-red font-bold animate-pulse ${className}`}>
            <LockIcon className="w-5 h-5" />
            <span className="uppercase tracking-widest text-sm">Picks Locked</span>
        </div>
    );
  }

  const { difference, timeLeft } = state;
  const tl = timeLeft as { d: number, h: number, m: number, s: number };
  
  if (!difference) return null;

  // Visual States
  const isUrgent = difference < 5 * 60 * 1000; // Less than 5 mins
  const isWarning = difference < 60 * 60 * 1000; // Less than 1 hour

  const textColor = isWarning ? 'text-primary-red' : 'text-ghost-white';
  const animationClass = isUrgent ? 'animate-pulse-red' : (isWarning ? 'animate-pulse' : '');

  return (
    <div className={`flex items-center gap-2 font-mono ${className} ${animationClass}`}>
        <div className="flex flex-col items-center">
            <span className={`text-xl md:text-2xl font-bold leading-none ${textColor}`}>{formatUnit(tl.d)}</span>
            <span className="text-[9px] text-highlight-silver uppercase tracking-wider">Days</span>
        </div>
        <span className={`text-xl mb-3 ${textColor}`}>:</span>
        <div className="flex flex-col items-center">
            <span className={`text-xl md:text-2xl font-bold leading-none ${textColor}`}>{formatUnit(tl.h)}</span>
            <span className="text-[9px] text-highlight-silver uppercase tracking-wider">Hrs</span>
        </div>
        <span className={`text-xl mb-3 ${textColor}`}>:</span>
        <div className="flex flex-col items-center">
            <span className={`text-xl md:text-2xl font-bold leading-none ${textColor}`}>{formatUnit(tl.m)}</span>
            <span className="text-[9px] text-highlight-silver uppercase tracking-wider">Min</span>
        </div>
        <span className={`text-xl mb-3 hidden sm:inline ${textColor}`}>:</span>
        <div className="flex flex-col items-center hidden sm:flex">
            <span className={`text-xl md:text-2xl font-bold leading-none ${textColor}`}>{formatUnit(tl.s)}</span>
            <span className="text-[9px] text-highlight-silver uppercase tracking-wider">Sec</span>
        </div>
    </div>
  );
};

export default CountdownTimer;
