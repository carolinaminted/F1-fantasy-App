
import React, { useState, useEffect } from 'react';
import { User, PickSelection, RaceResults, PointsSystem, Driver, Constructor, Event } from '../types.ts';
import { getUserPicks, updateUserAdminStatus, updateUserDuesStatus, updatePickPenalty, purgeUserData } from '../services/firestoreService.ts';
import ProfilePage from './ProfilePage.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { DuesIcon } from './icons/DuesIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { ProfileSkeleton } from './LoadingSkeleton.tsx';
import { useToast } from '../contexts/ToastContext.tsx';

interface AdminUserProfileViewProps {
    targetUser: User;
    raceResults: RaceResults;
    pointsSystem: PointsSystem;
    onUpdateUser: (updatedUser: User) => void;
    onDeleteUser: (userId: string) => void;
    allDrivers: Driver[];
    allConstructors: Constructor[];
    events: Event[];
}

const AdminUserProfileView: React.FC<AdminUserProfileViewProps> = ({ targetUser, raceResults, pointsSystem, onUpdateUser, onDeleteUser, allDrivers, allConstructors, events }) => {
    const [seasonPicks, setSeasonPicks] = useState<{ [eventId: string]: PickSelection }>({});
    const [isLoading, setIsLoading] = useState(true);
    
    // States for toggles
    const [isAdminState, setIsAdminState] = useState(false);
    const [isDuesPaidState, setIsDuesPaidState] = useState(false);
    
    // Saving states
    const [isSavingAdmin, setIsSavingAdmin] = useState(false);
    const [isSavingDues, setIsSavingDues] = useState(false);
    
    // Purge states
    const [isPurging, setIsPurging] = useState(false);
    const [showPurgeModal, setShowPurgeModal] = useState(false);

    const { showToast } = useToast();

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
            showToast(`Successfully ${isAdminState ? 'granted' : 'revoked'} admin privileges for ${targetUser.displayName}.`, 'success');
        } catch (error) {
            console.error("Failed to update admin status", error);
            showToast("Failed to update admin status. Please try again.", 'error');
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
            showToast(`Successfully updated dues status to ${newStatus} for ${targetUser.displayName}.`, 'success');
        } catch (error) {
            console.error("Failed to update dues status", error);
            showToast("Failed to update dues status. Please try again.", 'error');
            setIsDuesPaidState(targetUser.duesPaidStatus === 'Paid'); // Revert
        } finally {
            setIsSavingDues(false);
        }
    };

    const handlePenaltyUpdate = async (eventId: string, penalty: number, reason: string) => {
        try {
            await updatePickPenalty(targetUser.id, eventId, penalty, reason);
            // Update local state to reflect change immediately in the UI
            setSeasonPicks(prev => ({
                ...prev,
                [eventId]: {
                    ...prev[eventId],
                    penalty,
                    penaltyReason: reason
                }
            }));
            showToast("Penalty applied successfully.", 'success');
        } catch (error) {
            console.error("Failed to update penalty", error);
            showToast("Failed to apply penalty. Please try again.", 'error');
        }
    };

    const handleConfirmPurge = async () => {
        setIsPurging(true);
        try {
            await purgeUserData(targetUser.id);
            showToast(`User ${targetUser.displayName} purged successfully.`, 'success');
            setShowPurgeModal(false);
            onDeleteUser(targetUser.id);
        } catch (error) {
            console.error("Failed to purge user:", error);
            showToast("Failed to purge user data. Check console.", 'error');
            setIsPurging(false);
        }
    };

    if (isLoading) {
        return <ProfileSkeleton />;
    }

    return (
        <div>
            {/* Admin Management Panel */}
            <div className="bg-carbon-fiber border border-pure-white/10 rounded-xl p-6 mb-6 space-y-6 shadow-xl">
                <h3 className="font-bold text-pure-white text-xl border-b border-pure-white/10 pb-4 flex items-center gap-2">
                    <AdminIcon className="w-6 h-6 text-primary-red" />
                    Account Management
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Admin Toggle */}
                    <div className="flex flex-col gap-3 p-4 bg-carbon-black/40 rounded-xl border border-pure-white/5 hover:border-pure-white/10 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary-red/10 p-2 rounded-lg">
                                <AdminIcon className="w-6 h-6 text-primary-red" />
                            </div>
                            <div>
                                <h4 className="font-bold text-pure-white">Admin Privileges</h4>
                                <p className="text-xs text-highlight-silver">Access level</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-pure-white/5">
                            <label className="flex items-center cursor-pointer select-none group">
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only" 
                                        checked={isAdminState} 
                                        onChange={(e) => setIsAdminState(e.target.checked)}
                                    />
                                    <div className={`block w-12 h-7 rounded-full transition-colors ${isAdminState ? 'bg-primary-red' : 'bg-carbon-black border border-highlight-silver group-hover:border-pure-white'}`}></div>
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
                                    className="bg-primary-red hover:bg-red-600 text-pure-white font-bold py-1.5 px-4 rounded-lg text-xs disabled:opacity-50 transition-colors shadow-lg shadow-primary-red/20"
                                >
                                    {isSavingAdmin ? 'Saving...' : 'Save Changes'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Dues Toggle */}
                    <div className="flex flex-col gap-3 p-4 bg-carbon-black/40 rounded-xl border border-pure-white/5 hover:border-pure-white/10 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-600/10 p-2 rounded-lg">
                                <DuesIcon className="w-6 h-6 text-green-500" />
                            </div>
                            <div>
                                <h4 className="font-bold text-pure-white">League Dues</h4>
                                <p className="text-xs text-highlight-silver">Payment status</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-pure-white/5">
                            <label className="flex items-center cursor-pointer select-none group">
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only" 
                                        checked={isDuesPaidState} 
                                        onChange={(e) => setIsDuesPaidState(e.target.checked)}
                                    />
                                    <div className={`block w-12 h-7 rounded-full transition-colors ${isDuesPaidState ? 'bg-green-600' : 'bg-carbon-black border border-highlight-silver group-hover:border-pure-white'}`}></div>
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
                                    className="bg-green-600 hover:bg-green-500 text-pure-white font-bold py-1.5 px-4 rounded-lg text-xs disabled:opacity-50 transition-colors shadow-lg shadow-green-600/20"
                                >
                                    {isSavingDues ? 'Saving...' : 'Save Changes'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-accent-gray/30 p-3 rounded-lg text-center ring-1 ring-pure-white/10 mb-6 border border-pure-white/5">
                <p className="font-bold text-ghost-white text-sm">Impersonation View · <span className="text-highlight-silver font-normal">You are viewing this profile as an administrator.</span></p>
            </div>
            
            {/* Pass the penalty update callback to enable admin controls inside ProfilePage */}
            <ProfilePage 
                user={targetUser} 
                seasonPicks={seasonPicks} 
                raceResults={raceResults} 
                pointsSystem={pointsSystem}
                allDrivers={allDrivers}
                allConstructors={allConstructors}
                onUpdatePenalty={handlePenaltyUpdate}
                events={events}
            />

            {/* Danger Zone */}
            <div className="mt-8 border border-red-500/20 rounded-xl overflow-hidden bg-red-900/5">
                <div className="bg-red-900/20 px-6 py-4 border-b border-red-500/20 flex items-center gap-2">
                    <TrashIcon className="w-5 h-5 text-red-500" />
                    <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm">Danger Zone</h3>
                </div>
                <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-center md:text-left">
                        <h4 className="font-bold text-pure-white text-sm">Purge User Data</h4>
                        <p className="text-xs text-highlight-silver mt-1 max-w-md">
                            Permanently delete this user's profile, public stats, and all historical picks. Invitation code will be reset.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowPurgeModal(true)}
                        className="bg-red-600 hover:bg-red-500 text-pure-white font-bold py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-600/20 whitespace-nowrap"
                    >
                        Purge User Data
                    </button>
                </div>
            </div>

            {/* Purge Confirmation Modal */}
            {showPurgeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-black/90 backdrop-blur-sm p-4 animate-fade-in" onClick={() => !isPurging && setShowPurgeModal(false)}>
                    <div className="bg-carbon-fiber border border-red-500 rounded-xl p-6 md:p-8 max-w-md w-full text-center shadow-2xl shadow-red-900/50 ring-1 ring-red-500/30 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/50">
                            <TrashIcon className="w-8 h-8 text-red-500" />
                        </div>
                        
                        <h2 className="text-2xl font-bold text-pure-white mb-2">Confirm User Purge</h2>
                        <p className="text-highlight-silver mb-6 text-sm leading-relaxed">
                            Are you absolutely sure you want to delete <span className="text-pure-white font-bold">{targetUser.displayName}</span>?
                            <br/><br/>
                            <span className="text-red-400 font-bold">This action cannot be undone.</span> All picks, points, and profile data will be permanently erased.
                        </p>
                        
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleConfirmPurge}
                                disabled={isPurging}
                                className="w-full bg-red-600 hover:bg-red-500 text-pure-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isPurging ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        <span>Purging Data...</span>
                                    </>
                                ) : (
                                    'Yes, Purge User'
                                )}
                            </button>
                            <button
                                onClick={() => setShowPurgeModal(false)}
                                disabled={isPurging}
                                className="w-full bg-transparent hover:bg-pure-white/5 text-highlight-silver font-bold py-3 px-6 rounded-lg transition-colors border border-transparent hover:border-pure-white/10 uppercase text-xs"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUserProfileView;
