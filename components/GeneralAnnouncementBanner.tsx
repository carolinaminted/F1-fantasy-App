import React from 'react';
import { GeneralAnnouncementState } from '../types.ts';
import { dismissAnnouncementForUser } from '../services/firestoreService.ts';
import { SpeakerphoneIcon } from './icons/SpeakerphoneIcon.tsx';
import { Banner } from './ui/index.ts';

interface GeneralAnnouncementBannerProps {
    announcement: GeneralAnnouncementState;
    userId: string;
}

/** League-announcement strip on the Banner primitive; the dismiss write is unchanged. */
const GeneralAnnouncementBanner: React.FC<GeneralAnnouncementBannerProps> = ({ announcement, userId }) => {
    const handleDismiss = async () => {
        try {
            await dismissAnnouncementForUser(userId, announcement.announcementId);
        } catch (error) {
            console.error("Failed to dismiss announcement:", error);
        }
    };

    return (
        <Banner
            tone="info"
            icon={SpeakerphoneIcon}
            title="League Announcement"
            message={`"${announcement.message}"`}
            onDismiss={handleDismiss}
        />
    );
};

export default GeneralAnnouncementBanner;
