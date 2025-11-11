import React, { useState, useEffect } from 'react';
import { User, PickSelection, RaceResults } from '../types.ts';
import { getUserPicks } from '../services/firestoreService.ts';
import ProfilePage from './ProfilePage.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';

interface AdminUserProfileViewProps {
    targetUser: User;
    raceResults: RaceResults;
}

const AdminUserProfileView: React.FC<AdminUserProfileViewProps> = ({ targetUser, raceResults }) => {
    const [seasonPicks, setSeasonPicks] = useState<{ [eventId: string]: PickSelection }>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPicks = async () => {
            setIsLoading(true);
            const picks = await getUserPicks(targetUser.id);
            setSeasonPicks(picks || {});
            setIsLoading(false);
        };
        fetchPicks();
    }, [targetUser.id]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <F1CarIcon className="w-12 h-12 text-primary-red animate-pulse" />
                <span className="ml-4 text-lg text-highlight-silver">Loading {targetUser.displayName}'s data...</span>
            </div>
        );
    }

    return (
        <div>
            <div className="bg-accent-gray p-3 rounded-lg text-center ring-1 ring-primary-red mb-6">
                <p className="font-bold text-ghost-white">Impersonation View · <span className="text-highlight-silver">Read-Only</span></p>
            </div>
            <ProfilePage 
                user={targetUser} 
                seasonPicks={seasonPicks} 
                raceResults={raceResults} 
            />
        </div>
    );
};

export default AdminUserProfileView;