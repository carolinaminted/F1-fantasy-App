
import React, { useState, useRef } from 'react';
import { F1CarIcon } from './icons/F1CarIcon.tsx';

// Hook to manage the state and trigger logic
export const useRaceStartEasterEgg = () => {
  const [easterEggState, setEasterEggState] = useState<'idle' | 'lights' | 'racing' | 'finished'>('idle');
  const [activeLights, setActiveLights] = useState(0);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = () => {
      setEasterEggState('lights');
      setActiveLights(0);
      
      // Start the 5 red lights sequence
      let currentLight = 0;
      const interval = setInterval(() => {
          currentLight++;
          setActiveLights(currentLight);
          
          if (currentLight >= 5) {
              clearInterval(interval);
              
              // Random hold time before lights out (between 0.2s and 2s is realistic for F1)
              const holdTime = 200 + Math.random() * 1800;
              
              setTimeout(() => {
                  setEasterEggState('racing'); 
                  
                  // Trigger Confetti
                  import('canvas-confetti').then(module => {
                      const confetti = module.default;
                      // Initial Burst
                      confetti({
                          particleCount: 150,
                          spread: 100,
                          origin: { y: 0.6 },
                          colors: ['#DA291C', '#FFFFFF', '#000000'],
                          zIndex: 10000
                      });
                      
                      // Follow up side cannons
                      setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 }, zIndex: 10000 }), 300);
                      setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 }, zIndex: 10000 }), 300);
                  });

                  // Reset after race animation completes
                  setTimeout(() => {
                      setEasterEggState('finished');
                      setTimeout(() => setEasterEggState('idle'), 500);
                  }, 2500);
              }, holdTime);
          }
      }, 800); // 0.8s between each red light turning on
  };

  const handleTriggerClick = () => {
    clickCountRef.current += 1;
    
    // Start timer on first click
    if (clickCountRef.current === 1) {
        clickTimerRef.current = setTimeout(() => {
            clickCountRef.current = 0; // Reset
        }, 2000);
    }

    if (clickCountRef.current >= 5) {
        if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
        clickCountRef.current = 0;
        trigger();
        return true; // Signal that trigger happened
    }
    return false;
  };

  return { easterEggState, activeLights, handleTriggerClick };
};

// Component to render the visual overlay
export const EasterEggOverlay: React.FC<{ state: 'idle' | 'lights' | 'racing' | 'finished'; activeLights: number }> = ({ state, activeLights }) => {
    if (state === 'idle') return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center overflow-hidden">
              <style>
                  {`
                    @keyframes raceBy {
                        0% { transform: translateX(-120vw); opacity: 0; }
                        10% { opacity: 1; }
                        100% { transform: translateX(120vw); opacity: 1; }
                    }
                    .animate-race-car {
                        animation: raceBy 1.5s cubic-bezier(0.1, 0.7, 1.0, 0.1) forwards;
                    }
                    .animate-race-car-delayed {
                        animation: raceBy 1.6s cubic-bezier(0.1, 0.7, 1.0, 0.1) forwards;
                        animation-delay: 0.1s;
                    }
                  `}
              </style>

              {/* Start Lights */}
              <div className={`transition-opacity duration-100 mb-20 ${state === 'racing' ? 'opacity-0' : 'opacity-100'}`}>
                   <div className="bg-[#1a1a1a] p-4 md:p-6 rounded-3xl border-4 border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex gap-4 md:gap-6">
                       {[1, 2, 3, 4, 5].map(i => (
                           <div 
                              key={i} 
                              className={`w-12 h-12 md:w-20 md:h-20 rounded-full border-4 border-gray-700 shadow-inner transition-all duration-75 ${
                                  activeLights >= i 
                                  ? 'bg-[#FF0000] shadow-[0_0_40px_#FF0000] scale-105 border-red-900' 
                                  : 'bg-[#0f0f0f] opacity-50'
                              }`} 
                           />
                       ))}
                   </div>
              </div>
              
              {/* Racing Action */}
              {state === 'racing' && (
                  <div className="absolute inset-0 w-full h-full pointer-events-none flex items-center justify-center">
                      {/* Track Blur */}
                      <div className="absolute w-full h-40 bg-gray-800/20 blur-xl"></div>
                      
                      {/* Lights Out Text */}
                      <div className="absolute top-1/4 animate-ping text-5xl md:text-8xl font-black text-white italic uppercase tracking-tighter opacity-80">
                          LIGHTS OUT!
                      </div>

                      {/* Cars */}
                      <div className="relative w-full h-full">
                          {/* Car 1: Red Bull / Max Style */}
                          <div className="absolute top-[45%] left-0 animate-race-car">
                              <F1CarIcon className="w-48 h-48 md:w-80 md:h-80 text-primary-red rotate-90 filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]" />
                              <div className="absolute top-1/2 left-0 w-full h-2 bg-white/10 blur-xl"></div>
                          </div>

                          {/* Car 2: McLaren / Lando Style */}
                          <div className="absolute top-[55%] left-0 animate-race-car-delayed">
                              <F1CarIcon className="w-48 h-48 md:w-80 md:h-80 text-yellow-500 rotate-90 filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]" />
                          </div>
                      </div>
                  </div>
              )}
          </div>
    );
};
