
import React, { useEffect, useState } from 'react';
import { signOut } from '@firebase/auth';
import { auth } from '../services/firebase.ts';

interface RedFlagScreenProps {
    message?: string;
}

const RedFlagScreen: React.FC<RedFlagScreenProps> = ({ message }) => {
    const [time, setTime] = useState(new Date());
    const [activeLight, setActiveLight] = useState(0);
    const [dots, setDots] = useState('');

    useEffect(() => {
        // Clock Update
        const clockInterval = setInterval(() => {
            setTime(new Date());
        }, 1000);

        // Light Sequence (F1 Start Cadence)
        const lightInterval = setInterval(() => {
            setActiveLight(prev => {
                if (prev >= 5) return 0;
                return prev + 1;
            });
        }, 800);

        // Text Animation
        const dotsInterval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 500);

        return () => {
            clearInterval(clockInterval);
            clearInterval(lightInterval);
            clearInterval(dotsInterval);
        };
    }, []);

    const handleLogout = () => {
        signOut(auth).catch(console.error);
    };

    // Particles
    const particles = Array.from({ length: 15 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 5}s`,
        duration: `${3 + Math.random() * 4}s`,
        opacity: 0.3 + Math.random() * 0.5
    }));

    return (
        <div className="fixed inset-0 z-[9999] bg-[#0A0A0A] overflow-hidden flex flex-col items-center justify-center font-exo text-ghost-white select-none">
            <style>
                {`
                    @keyframes floatUp {
                        0% { transform: translateY(100vh) scale(0.5); opacity: 0; }
                        50% { opacity: 1; }
                        100% { transform: translateY(-10vh) scale(1.5); opacity: 0; }
                    }
                    @keyframes scanline {
                        0% { top: -10%; }
                        100% { top: 110%; }
                    }
                    @keyframes pulseGlow {
                        0%, 100% { box-shadow: 0 0 40px rgba(218, 41, 28, 0.2); }
                        50% { box-shadow: 0 0 60px rgba(218, 41, 28, 0.4); }
                    }
                    @keyframes flagWave {
                        0% { d: path("M10,0 Q25,5 40,0 T70,0 V40 Q55,45 40,40 T10,40 Z"); }
                        50% { d: path("M10,5 Q25,0 40,5 T70,5 V45 Q55,40 40,45 T10,45 Z"); }
                        100% { d: path("M10,0 Q25,5 40,0 T70,0 V40 Q55,45 40,40 T10,40 Z"); }
                    }
                    .font-exo { font-family: 'Exo 2', sans-serif; }
                `}
            </style>

            {/* Background Carbon Fiber Pattern */}
            <div className="absolute inset-0 bg-carbon-fiber opacity-30 pointer-events-none"></div>

            {/* Rising Sparks */}
            {particles.map(p => (
                <div 
                    key={p.id}
                    className="absolute w-1 h-1 bg-[#DA291C] rounded-full pointer-events-none"
                    style={{
                        left: p.left,
                        animation: `floatUp ${p.duration} linear infinite`,
                        animationDelay: p.delay,
                        opacity: p.opacity
                    }}
                />
            ))}

            {/* Scanline Overlay */}
            <div className="absolute inset-0 pointer-events-none z-10" style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.2) 51%)', backgroundSize: '100% 4px' }}></div>
            <div className="absolute w-full h-[2px] bg-[#DA291C] opacity-20 pointer-events-none z-10" style={{ animation: 'scanline 6s linear infinite' }}></div>

            {/* Main Content Card */}
            <div className="relative z-20 bg-carbon-black border border-[#DA291C]/30 p-8 md:p-12 rounded-2xl max-w-2xl w-[90%] flex flex-col items-center text-center shadow-[0_0_40px_rgba(218,41,28,0.2)]" style={{ animation: 'pulseGlow 4s ease-in-out infinite' }}>
                
                {/* F1 Lights */}
                <div className="flex gap-3 md:gap-5 mb-8 md:mb-10 bg-black/50 p-4 rounded-full border border-gray-800 shadow-inner">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div 
                            key={i}
                            className={`w-6 h-6 md:w-10 md:h-10 rounded-full border-2 border-gray-700 transition-all duration-75 ${
                                activeLight >= i 
                                ? 'bg-[#FF0000] shadow-[0_0_20px_#FF0000] scale-110 border-red-900' 
                                : 'bg-[#1a1a1a] opacity-30'
                            }`}
                        />
                    ))}
                </div>

                {/* Animated Flag (SVG) */}
                <div className="mb-6 relative w-24 h-24 md:w-32 md:h-32">
                    <svg viewBox="0 0 80 80" className="w-full h-full drop-shadow-[0_0_15px_rgba(218,41,28,0.5)]">
                        {/* Pole */}
                        <rect x="5" y="0" width="4" height="80" fill="#C0C0C0" rx="2" />
                        {/* Flag Body with Animation */}
                        <path fill="url(#flagGradient)">
                            <animate 
                                attributeName="d" 
                                dur="1.5s" 
                                repeatCount="indefinite"
                                values="
                                    M9,5 Q25,0 40,5 T70,5 V45 Q55,40 40,45 T9,45 Z;
                                    M9,10 Q25,15 40,10 T70,10 V50 Q55,55 40,50 T9,50 Z;
                                    M9,5 Q25,0 40,5 T70,5 V45 Q55,40 40,45 T9,45 Z
                                "
                            />
                        </path>
                        <defs>
                            <linearGradient id="flagGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#990000" />
                                <stop offset="50%" stopColor="#DA291C" />
                                <stop offset="100%" stopColor="#FF3333" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>

                <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter text-pure-white mb-2 drop-shadow-[0_0_20px_rgba(218,41,28,0.6)]">
                    RED FLAG
                </h1>
                
                <p className="font-mono text-xs md:text-sm text-highlight-silver tracking-[0.4em] opacity-70 mb-8 border-t border-b border-white/10 py-2 w-full">
                    SESSION SUSPENDED
                </p>

                <div className="space-y-2 mb-8">
                    <p className="text-lg md:text-xl font-bold text-pure-white animate-pulse">
                        Our pit crew is working on the car{dots}
                    </p>
                    <p className="text-sm md:text-base text-highlight-silver/60 font-light">
                        We'll be back on track shortly.
                    </p>
                </div>

                {/* Telemetry Block */}
                <div className="w-full bg-black/40 rounded-lg p-4 border border-white/5 font-mono text-xs md:text-sm space-y-2 text-left shadow-inner">
                    <div className="flex justify-between border-l-2 border-[#DA291C] pl-3 bg-white/5 py-1">
                        <span className="text-highlight-silver/70">STATUS</span>
                        <span className="text-[#DA291C] font-bold animate-pulse">RED FLAG</span>
                    </div>
                    <div className="flex justify-between border-l-2 border-yellow-500 pl-3 bg-white/5 py-1">
                        <span className="text-highlight-silver/70">SYSTEM</span>
                        <span className="text-yellow-500 font-bold">MAINTENANCE</span>
                    </div>
                    <div className="flex justify-between border-l-2 border-highlight-silver pl-3 bg-white/5 py-1">
                        <span className="text-highlight-silver/70">ETA</span>
                        <span className="text-pure-white font-bold animate-pulse">STAND BY...</span>
                    </div>
                </div>

                <div className="mt-8 font-mono text-xs text-highlight-silver/30 uppercase tracking-widest">
                    LOCAL TIME: {time.toLocaleTimeString()}
                </div>
            </div>

            {/* Sign Out Button */}
            <div className="relative z-30 mt-4 mb-20">
                <button 
                    onClick={handleLogout}
                    className="text-highlight-silver hover:text-pure-white text-xs font-bold uppercase tracking-widest border border-highlight-silver/30 hover:border-pure-white px-4 py-2 rounded transition-all backdrop-blur-sm"
                >
                    Sign Out
                </button>
            </div>

            {/* Bottom Ticker */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#DA291C]/90 h-10 flex items-center overflow-hidden border-t border-[#DA291C] z-30">
                <div className="whitespace-nowrap animate-[marquee_15s_linear_infinite] font-mono font-bold text-pure-white text-sm tracking-wider flex gap-8">
                    <style>{`@keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }`}</style>
                    <span>SESSION SUSPENDED</span>
                    <span>◆</span>
                    <span>{message || "PIT CREW AT WORK"}</span>
                    <span>◆</span>
                    <span>STAND BY FOR GREEN FLAG</span>
                    <span>◆</span>
                    <span>LIGHTS OUT LEAGUE</span>
                    <span>◆</span>
                    <span>SESSION SUSPENDED</span>
                    <span>◆</span>
                    <span>{message || "PIT CREW AT WORK"}</span>
                </div>
            </div>

            {/* Watermark */}
            <div className="fixed bottom-12 left-0 right-0 text-center opacity-10 pointer-events-none">
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white">LIGHTS OUT LEAGUE</span>
            </div>
        </div>
    );
};

export default RedFlagScreen;
