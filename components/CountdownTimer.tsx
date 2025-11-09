
import React, { useState, useEffect } from 'react';
import { Event } from '../types';

interface CountdownTimerProps {
  event: Event;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ event }) => {
  const [timeLeft, setTimeLeft] = useState({
    soft: { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 },
    lock: { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 },
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const softDeadline = new Date(event.softDeadlineUtc);
      const lockTime = new Date(event.lockAtUtc);
      
      const softDifference = +softDeadline - +now;
      const lockDifference = +lockTime - +now;

      const format = (diff: number) => ({
        total: diff,
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });

      return {
        soft: softDifference > 0 ? format(softDifference) : { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 },
        lock: lockDifference > 0 ? format(lockDifference) : { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 },
      };
    };

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [event]);

  const isLateWindow = timeLeft.soft.total <= 0 && timeLeft.lock.total > 0;
  const isLocked = timeLeft.lock.total <= 0;

  const renderTime = (time: { hours: number, minutes: number, seconds: number }) => {
    return `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}:${String(time.seconds).padStart(2, '0')}`;
  }

  return (
    <div className={`p-3 rounded-lg text-center ${isLateWindow ? 'bg-yellow-500/20' : 'bg-gray-900/50'}`}>
        <p className="text-sm uppercase tracking-wider font-semibold text-gray-400">
            {isLocked ? "Picks Locked" : (isLateWindow ? "Late Window" : "Picks Open")}
        </p>
        <p className={`text-2xl font-bold tracking-tighter ${isLocked ? "text-red-500" : (isLateWindow ? "text-yellow-400" : "text-white")}`}>
            {isLocked ? "LOCKED" : (isLateWindow ? renderTime(timeLeft.lock) : renderTime(timeLeft.soft))}
        </p>
         <p className="text-xs text-gray-500">
            {isLocked ? "Submissions Closed" : (isLateWindow ? "until lock" : "until late window")}
        </p>
    </div>
  );
};

export default CountdownTimer;
