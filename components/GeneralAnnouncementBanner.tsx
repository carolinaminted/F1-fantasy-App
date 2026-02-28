import React from 'react';
import { GeneralAnnouncementState } from '../types.ts';
import { dismissAnnouncementForUser } from '../services/firestoreService.ts';
import { SpeakerphoneIcon } from './icons/SpeakerphoneIcon.tsx';

interface GeneralAnnouncementBannerProps {
    announcement: GeneralAnnouncementState;
    userId: string;
}

const GeneralAnnouncementBanner: React.FC<GeneralAnnouncementBannerProps> = ({ announcement, userId }) => {
    
    const handleDismiss = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await dismissAnnouncementForUser(userId, announcement.announcementId);
        } catch (error) {
            console.error("Failed to dismiss announcement:", error);
        }
    };

    return (
        <div className="bg-indigo-900/90 backdrop-blur-md text-pure-white px-4 py-3 shadow-lg border-b-2 border-indigo-500 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in-down">
            <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="hidden sm:block p-2 bg-indigo-500/20 rounded-full border border-indigo-500/30">
                    <SpeakerphoneIcon className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                    <h3 className="font-bold text-base leading-tight">
                        League Announcement
                    </h3>
                    <p className="text-xs text-indigo-200/80 mt-1 italic">
                        "{announcement.message}"
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 w-full sm:w-auto">
                <button
                    onClick={handleDismiss}
                    className="flex-shrink-0 bg-transparent hover:bg-white/10 text-white rounded-full p-2 transition-colors ml-auto sm:ml-0"
                    aria-label="Dismiss announcement"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div>
    );
};

export default GeneralAnnouncementBanner;
