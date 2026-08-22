import React from 'react';
import { ResultsAnnouncementState } from '../types.ts';
import { dismissAnnouncementForUser } from '../services/firestoreService.ts';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { Banner } from './ui/index.ts';

interface ResultsAnnouncementBannerProps {
    announcement: ResultsAnnouncementState;
    userId: string;
    setActivePage: (page: 'gp-results', params?: { eventId?: string }) => void;
}

/** Results-are-in strip. Gate 13 moved the markup onto the Banner primitive; the dismiss
 *  and navigate writes are unchanged. */
const ResultsAnnouncementBanner: React.FC<ResultsAnnouncementBannerProps> = ({ announcement, userId, setActivePage }) => {
    const handleDismiss = async () => {
        try {
            await dismissAnnouncementForUser(userId, announcement.announcementId);
        } catch (error) {
            console.error("Failed to dismiss announcement:", error);
        }
    };

    const handleNavigate = () => {
        setActivePage('gp-results', { eventId: announcement.eventId });
        // Automatically dismiss when the user takes action
        dismissAnnouncementForUser(userId, announcement.announcementId).catch(console.error);
    };

    return (
        <Banner
            tone="success"
            icon={TrophyIcon}
            title={`Results are in for the ${announcement.eventName}!`}
            message={announcement.message ? `"${announcement.message}"` : undefined}
            onDismiss={handleDismiss}
            action={
                <button
                    onClick={handleNavigate}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-pure-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg shadow-md transition-colors"
                >
                    View Results
                </button>
            }
        />
    );
};

export default ResultsAnnouncementBanner;
