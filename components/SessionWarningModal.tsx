
import React, { useState, useEffect } from 'react';
import { HistoryIcon } from './icons/HistoryIcon.tsx';

interface SessionWarningModalProps {
    isOpen: boolean;
    expiryTime: number; // Timestamp when session dies
    onContinue: () => void;
    onLogout: () => void;
}

const SessionWarningModal: React.FC<SessionWarningModalProps> = ({ isOpen, expiryTime, onContinue, onLogout }) => {
    const [timeLeft, setTimeLeft] = useState<number>(0);

    useEffect(() => {
        if (!isOpen) return;

        // Initialize immediately
        setTimeLeft(Math.max(0, Math.ceil((expiryTime - Date.now()) / 1000)));

        const interval = setInterval(() => {
            const secondsRemaining = Math.max(0, Math.ceil((expiryTime - Date.now()) / 1000));
            setTimeLeft(secondsRemaining);
            
            // If time runs out, the parent hook will handle the actual logout logic
            if (secondsRemaining <= 0) {
                clearInterval(interval);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isOpen, expiryTime]);

    if (!isOpen) return null;

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon-black/90 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-accent-gray border border-primary-red/50 rounded-xl p-8 max-w-sm w-full text-center shadow-[0_0_50px_rgba(218,41,28,0.2)] ring-1 ring-pure-white/10">
                <div className="w-16 h-16 bg-primary-red/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <HistoryIcon className="w-8 h-8 text-primary-red" />
                </div>
                
                <h2 className="text-2xl font-bold text-pure-white mb-2">Are you still there?</h2>
                <p className="text-highlight-silver mb-6">
                    Your session will expire due to inactivity in:
                </p>
                
                <div className="text-5xl font-black text-pure-white mb-8 font-mono tracking-wider">
                    {formattedTime}
                </div>

                <div className="space-y-3">
                    <button
                        onClick={onContinue}
                        className="w-full bg-primary-red hover:bg-red-600 text-pure-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-primary-red/20"
                    >
                        Continue Session
                    </button>
                    <button
                        onClick={onLogout}
                        className="w-full bg-transparent hover:bg-pure-white/5 text-highlight-silver font-bold py-3 px-6 rounded-lg transition-colors border border-transparent hover:border-pure-white/10"
                    >
                        Log Out Now
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SessionWarningModal;
