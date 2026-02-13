import React from 'react';
import { ResultsAnnouncementState } from '../types.ts';
import { dismissAnnouncementForUser } from '../services/firestoreService.ts';
import { TrophyIcon } from './icons/TrophyIcon.tsx';

interface ResultsAnnouncementBannerProps {
    announcement: ResultsAnnouncementState;
    userId: string;
    setActivePage: (page: 'gp-results', params?: { eventId?: string }) => void;
}

const ResultsAnnouncementBanner: React.FC<ResultsAnnouncementBannerProps> = ({ announcement, userId, setActivePage }) => {
    
    const handleDismiss = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await dismissAnnouncementForUser(userId, announcement.announcementId);
        } catch (error) {
            console.error("Failed to dismiss announcement:", error);
        }
    };

    const handleNavigate = (e: React.MouseEvent) => {
        e.stopPropagation();
        setActivePage('gp-results', { eventId: announcement.eventId });
        // Automatically dismiss when the user takes action
        dismissAnnouncementForUser(userId, announcement.announcementId).catch(console.error);
    };

    return (
        <div className="bg-green-900/90 backdrop-blur-md text-pure-white px-4 py-3 shadow-lg border-b-2 border-green-500 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in-down">
            <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="hidden sm:block p-2 bg-green-500/20 rounded-full border border-green-500/30">
                    <TrophyIcon className="w-6 h-6 text-green-400" />
                </div>
                <div>
                    <h3 className="font-bold text-base leading-tight">
                        Results are in for the {announcement.eventName}!
                    </h3>
                    {announcement.message && (
                        <p className="text-xs text-green-200/80 mt-1 italic">
                            "{announcement.message}"
                        </p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 w-full sm:w-auto">
                <button
                    onClick={handleNavigate}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-pure-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg shadow-md transition-transform hover:scale-105"
                >
                    View Results
                </button>
                <button
                    onClick={handleDismiss}
                    className="flex-shrink-0 bg-transparent hover:bg-white/10 text-white rounded-full p-2 transition-colors"
                    aria-label="Dismiss announcement"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div>
    );
};

export default ResultsAnnouncementBanner;
