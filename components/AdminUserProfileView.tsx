
import React, { useState, useEffect } from 'react';
import { User, PickSelection, RaceResults, PointsSystem } from '../types.ts';
import { getUserPicks, updateUserAdminStatus } from '../services/firestoreService.ts';
import ProfilePage from './ProfilePage.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';

interface AdminUserProfileViewProps {
    targetUser: User;
    raceResults: RaceResults;
    pointsSystem: PointsSystem;
    onUpdateUser: (updatedUser: User) => void;
}

const AdminUserProfileView: React.FC<AdminUserProfileViewProps> = ({ targetUser, raceResults, pointsSystem, onUpdateUser }) => {
    const [seasonPicks, setSeasonPicks] = useState<{ [eventId: string]: PickSelection }>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isAdminState, setIsAdminState] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchPicks = async () => {
            setIsLoading(true);
            const picks = await getUserPicks(targetUser.id);
            setSeasonPicks(picks || {});
            setIsAdminState(!!targetUser.isAdmin);
            setIsLoading(false);
        };
        fetchPicks();
    }, [targetUser.id, targetUser.isAdmin]);

    const handleSaveAdminStatus = async () => {
        setIsSaving(true);
        try {
            await updateUserAdminStatus(targetUser.id, isAdminState);
            onUpdateUser({ ...targetUser, isAdmin: isAdminState });
            alert(`Successfully ${isAdminState ? 'granted' : 'revoked'} admin privileges for ${targetUser.displayName}.`);
        } catch (error) {
            console.error("Failed to update admin status", error);
            alert("Failed to update admin status. Please try again.");
            // Revert state on error
            setIsAdminState(!!targetUser.isAdmin);
        } finally {
            setIsSaving(false);
        }
    };

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
            {/* Admin Management Panel */}
            <div className="bg-accent-gray/50 border border-highlight-silver/20 rounded-lg p-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-primary-red/10 p-2 rounded-lg">
                        <AdminIcon className="w-6 h-6 text-primary-red" />
                    </div>
                    <div>
                        <h3 className="font-bold text-pure-white">Admin Privileges</h3>
                        <p className="text-sm text-highlight-silver">Manage access level for this user.</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <label className="flex items-center cursor-pointer select-none">
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                className="sr-only" 
                                checked={isAdminState} 
                                onChange={(e) => setIsAdminState(e.target.checked)}
                            />
                            <div className={`block w-14 h-8 rounded-full transition-colors ${isAdminState ? 'bg-primary-red' : 'bg-carbon-black border border-highlight-silver'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isAdminState ? 'transform translate-x-6' : ''}`}></div>
                        </div>
                        <div className="ml-3 font-medium text-pure-white">
                            {isAdminState ? 'Admin Enabled' : 'Standard User'}
                        </div>
                    </label>

                    {(isAdminState !== !!targetUser.isAdmin) && (
                        <button 
                            onClick={handleSaveAdminStatus}
                            disabled={isSaving}
                            className="bg-primary-red hover:opacity-90 text-pure-white font-bold py-2 px-6 rounded-lg text-sm disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isSaving ? 'Saving...' : 'Save Change'}
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-accent-gray p-3 rounded-lg text-center ring-1 ring-primary-red mb-6">
                <p className="font-bold text-ghost-white">Impersonation View · <span className="text-highlight-silver">Read-Only</span></p>
            </div>
            <ProfilePage 
                user={targetUser} 
                seasonPicks={seasonPicks} 
                raceResults={raceResults} 
                pointsSystem={pointsSystem}
            />
        </div>
    );
};

export default AdminUserProfileView;