
import React, { useState, useEffect } from 'react';
import { User, PickSelection, RaceResults, PointsSystem, Driver, Constructor } from '../types.ts';
import { getUserPicks, updateUserAdminStatus, updateUserDuesStatus } from '../services/firestoreService.ts';
import ProfilePage from './ProfilePage.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { DuesIcon } from './icons/DuesIcon.tsx';

interface AdminUserProfileViewProps {
    targetUser: User;
    raceResults: RaceResults;
    pointsSystem: PointsSystem;
    onUpdateUser: (updatedUser: User) => void;
    allDrivers: Driver[];
    allConstructors: Constructor[];
}

const AdminUserProfileView: React.FC<AdminUserProfileViewProps> = ({ targetUser, raceResults, pointsSystem, onUpdateUser, allDrivers, allConstructors }) => {
    const [seasonPicks, setSeasonPicks] = useState<{ [eventId: string]: PickSelection }>({});
    const [isLoading, setIsLoading] = useState(true);
    
    // States for toggles
    const [isAdminState, setIsAdminState] = useState(false);
    const [isDuesPaidState, setIsDuesPaidState] = useState(false);
    
    // Saving states
    const [isSavingAdmin, setIsSavingAdmin] = useState(false);
    const [isSavingDues, setIsSavingDues] = useState(false);

    useEffect(() => {
        const fetchPicks = async () => {
            setIsLoading(true);
            const picks = await getUserPicks(targetUser.id);
            setSeasonPicks(picks || {});
            
            // Initialize toggle states based on user object
            setIsAdminState(!!targetUser.isAdmin);
            setIsDuesPaidState(targetUser.duesPaidStatus === 'Paid');
            
            setIsLoading(false);
        };
        fetchPicks();
    }, [targetUser.id, targetUser.isAdmin, targetUser.duesPaidStatus]);

    const handleSaveAdminStatus = async () => {
        setIsSavingAdmin(true);
        try {
            await updateUserAdminStatus(targetUser.id, isAdminState);
            onUpdateUser({ ...targetUser, isAdmin: isAdminState });
            alert(`Successfully ${isAdminState ? 'granted' : 'revoked'} admin privileges for ${targetUser.displayName}.`);
        } catch (error) {
            console.error("Failed to update admin status", error);
            alert("Failed to update admin status. Please try again.");
            setIsAdminState(!!targetUser.isAdmin); // Revert
        } finally {
            setIsSavingAdmin(false);
        }
    };

    const handleSaveDuesStatus = async () => {
        setIsSavingDues(true);
        const newStatus = isDuesPaidState ? 'Paid' : 'Unpaid';
        try {
            await updateUserDuesStatus(targetUser.id, newStatus);
            onUpdateUser({ ...targetUser, duesPaidStatus: newStatus });
            alert(`Successfully updated dues status to ${newStatus} for ${targetUser.displayName}.`);
        } catch (error) {
            console.error("Failed to update dues status", error);
            alert("Failed to update dues status. Please try again.");
            setIsDuesPaidState(targetUser.duesPaidStatus === 'Paid'); // Revert
        } finally {
            setIsSavingDues(false);
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
            <div className="bg-accent-gray/50 border border-highlight-silver/20 rounded-lg p-4 mb-6 space-y-4">
                <h3 className="font-bold text-pure-white text-lg border-b border-highlight-silver/10 pb-2">Account Management</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Admin Toggle */}
                    <div className="flex flex-col gap-3 p-3 bg-carbon-black/30 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary-red/10 p-2 rounded-lg">
                                <AdminIcon className="w-6 h-6 text-primary-red" />
                            </div>
                            <div>
                                <h4 className="font-bold text-pure-white">Admin Privileges</h4>
                                <p className="text-xs text-highlight-silver">Access level</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                            <label className="flex items-center cursor-pointer select-none">
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only" 
                                        checked={isAdminState} 
                                        onChange={(e) => setIsAdminState(e.target.checked)}
                                    />
                                    <div className={`block w-12 h-7 rounded-full transition-colors ${isAdminState ? 'bg-primary-red' : 'bg-carbon-black border border-highlight-silver'}`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${isAdminState ? 'transform translate-x-5' : ''}`}></div>
                                </div>
                                <div className="ml-3 font-medium text-sm text-pure-white">
                                    {isAdminState ? 'Admin' : 'User'}
                                </div>
                            </label>

                            {(isAdminState !== !!targetUser.isAdmin) && (
                                <button 
                                    onClick={handleSaveAdminStatus}
                                    disabled={isSavingAdmin}
                                    className="bg-primary-red hover:opacity-90 text-pure-white font-bold py-1 px-3 rounded text-xs disabled:opacity-50"
                                >
                                    {isSavingAdmin ? '...' : 'Save'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Dues Toggle */}
                    <div className="flex flex-col gap-3 p-3 bg-carbon-black/30 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-600/10 p-2 rounded-lg">
                                <DuesIcon className="w-6 h-6 text-green-500" />
                            </div>
                            <div>
                                <h4 className="font-bold text-pure-white">League Dues</h4>
                                <p className="text-xs text-highlight-silver">Payment status</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                            <label className="flex items-center cursor-pointer select-none">
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only" 
                                        checked={isDuesPaidState} 
                                        onChange={(e) => setIsDuesPaidState(e.target.checked)}
                                    />
                                    <div className={`block w-12 h-7 rounded-full transition-colors ${isDuesPaidState ? 'bg-green-600' : 'bg-carbon-black border border-highlight-silver'}`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${isDuesPaidState ? 'transform translate-x-5' : ''}`}></div>
                                </div>
                                <div className="ml-3 font-medium text-sm text-pure-white">
                                    {isDuesPaidState ? 'Paid' : 'Unpaid'}
                                </div>
                            </label>

                             {((isDuesPaidState ? 'Paid' : 'Unpaid') !== (targetUser.duesPaidStatus || 'Unpaid')) && (
                                <button 
                                    onClick={handleSaveDuesStatus}
                                    disabled={isSavingDues}
                                    className="bg-green-600 hover:opacity-90 text-pure-white font-bold py-1 px-3 rounded text-xs disabled:opacity-50"
                                >
                                    {isSavingDues ? '...' : 'Save'}
                                </button>
                            )}
                        </div>
                    </div>
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
                allDrivers={allDrivers}
                allConstructors={allConstructors}
            />
        </div>
    );
};

export default AdminUserProfileView;
