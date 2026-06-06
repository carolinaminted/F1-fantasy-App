
import React, { useState, useEffect } from 'react';
import { User, PickSelection, RaceResults, PointsSystem, Driver, Constructor, Event, EntityClass } from '../types.ts';
import { getUserPicks, updateUserAdminStatus, updateUserDuesStatus, updatePickPenalty, purgeUserData, saveUserPicks, logAdminAction } from '../services/firestoreService.ts';
import ProfilePage from './ProfilePage.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { DuesIcon } from './icons/DuesIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { ProfileSkeleton } from './LoadingSkeleton.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import { auth } from '../services/firebase.ts';

interface AdminUserProfileViewProps {
    targetUser: User;
    raceResults: RaceResults;
    pointsSystem: PointsSystem;
    onUpdateUser: (updatedUser: User) => void;
    onDeleteUser: (userId: string) => void;
    allDrivers: Driver[];
    allConstructors: Constructor[];
    events: Event[];
    cancelledEventIds: Set<string>;
}

const AdminUserProfileView: React.FC<AdminUserProfileViewProps> = ({ targetUser, raceResults, pointsSystem, onUpdateUser, onDeleteUser, allDrivers, allConstructors, events, cancelledEventIds }) => {
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

    // Pick overrides features
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [adminPicks, setAdminPicks] = useState<PickSelection>({
        aTeams: [null, null],
        bTeam: null,
        aDrivers: [null, null, null],
        bDrivers: [null, null],
        fastestLap: null
    });
    const [isSubmittingPicks, setIsSubmittingPicks] = useState(false);

    const { showToast } = useToast();

    useEffect(() => {
        if (selectedEventId) {
            const existingPicks = seasonPicks[selectedEventId];
            if (existingPicks) {
                setAdminPicks({
                    aTeams: Array.isArray(existingPicks.aTeams) ? [...existingPicks.aTeams] : [null, null],
                    bTeam: existingPicks.bTeam || null,
                    aDrivers: Array.isArray(existingPicks.aDrivers) ? [...existingPicks.aDrivers] : [null, null, null],
                    bDrivers: Array.isArray(existingPicks.bDrivers) ? [...existingPicks.bDrivers] : [null, null],
                    fastestLap: existingPicks.fastestLap || null,
                    penalty: existingPicks.penalty || 0,
                    penaltyReason: existingPicks.penaltyReason || ''
                });
            } else {
                setAdminPicks({
                    aTeams: [null, null],
                    bTeam: null,
                    aDrivers: [null, null, null],
                    bDrivers: [null, null],
                    fastestLap: null
                });
            }
        }
    }, [selectedEventId, seasonPicks]);

    const handleAdminSubmitPicks = async () => {
        if (!selectedEventId) {
            showToast("Please select an event first.", 'error');
            return;
        }

        const hasDuplicates = (arr: (string | null)[]) => {
            const filtered = arr.filter(Boolean);
            return filtered.length !== new Set(filtered).size;
        };

        if (hasDuplicates(adminPicks.aTeams)) {
            showToast("Duplicate Class A Teams selected.", 'error');
            return;
        }
        if (hasDuplicates(adminPicks.aDrivers)) {
            showToast("Duplicate Class A Drivers selected.", 'error');
            return;
        }
        if (hasDuplicates(adminPicks.bDrivers)) {
            showToast("Duplicate Class B Drivers selected.", 'error');
            return;
        }

        setIsSubmittingPicks(true);
        try {
            await saveUserPicks(targetUser.id, selectedEventId, adminPicks, true);

            const adminUser = auth.currentUser;
            await logAdminAction({
                adminId: adminUser?.uid || 'unknown_admin',
                adminName: adminUser?.displayName || adminUser?.email || 'Admin',
                eventId: selectedEventId,
                eventName: events.find(e => e.id === selectedEventId)?.name || selectedEventId,
                action: 'admin_pick_override',
                changes: `Administrative pick submitted on behalf of user ${targetUser.displayName} (${targetUser.email || 'No email'})`
            });

            setSeasonPicks(prev => ({
                ...prev,
                [selectedEventId]: adminPicks
            }));

            showToast(`Picks successfully submitted on behalf of ${targetUser.displayName} for event ${selectedEventId}.`, 'success');
        } catch (error) {
            console.error("Failed to submit picks on behalf:", error);
            showToast("Failed to save picks on behalf of user.", 'error');
        } finally {
            setIsSubmittingPicks(false);
        }
    };

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

    const aDriversList = allDrivers.filter(d => d.class === EntityClass.A && d.isActive);
    const bDriversList = allDrivers.filter(d => d.class === EntityClass.B && d.isActive);
    const aTeamsList = allConstructors.filter(c => c.class === EntityClass.A && c.isActive);
    const bTeamsList = allConstructors.filter(c => c.class === EntityClass.B && c.isActive);

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

            {/* Submit Picks on Behalf of User */}
            <div className="bg-carbon-fiber border border-pure-white/10 rounded-xl p-6 mb-6 space-y-6 shadow-xl">
                <h3 className="font-bold text-pure-white text-xl border-b border-pure-white/10 pb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <span className="text-primary-red font-black">⚙</span> Submit / Edit Picks on Behalf of User
                    </span>
                    <span className="text-xs text-highlight-silver bg-primary-red/10 border border-primary-red/20 px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold">Admin Override Mode</span>
                </h3>

                <div className="space-y-4">
                    {/* Event Selector */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-highlight-silver">Select Event</label>
                        <select
                            value={selectedEventId}
                            onChange={(e) => setSelectedEventId(e.target.value)}
                            className="bg-carbon-black border border-accent-gray rounded px-3 py-2 text-pure-white text-sm focus:border-primary-red focus:outline-none w-full"
                        >
                            <option value="">-- Choose Event --</option>
                            {events.map(ev => {
                                const hasPicks = !!seasonPicks[ev.id];
                                return (
                                    <option key={ev.id} value={ev.id}>
                                        Round {ev.round}: {ev.name} ({ev.location}) {hasPicks ? '✓ (Picks Exist)' : '(No Picks)'}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {selectedEventId && (
                        <div className="space-y-6 pt-4 border-t border-pure-white/5 animate-fade-in-up">
                            {/* Teams Row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Class A Teams */}
                                <div className="p-4 bg-carbon-black/40 rounded-xl border border-pure-white/5 space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary-red">Class A Teams (Select 2)</h4>
                                    <div className="space-y-2">
                                        <select
                                            value={adminPicks.aTeams[0] || ''}
                                            onChange={(e) => {
                                                const val = e.target.value || null;
                                                setAdminPicks(prev => ({
                                                    ...prev,
                                                    aTeams: [val, prev.aTeams[1]]
                                                }));
                                            }}
                                            className="bg-carbon-black border border-accent-gray rounded px-3 py-1.5 text-pure-white text-xs focus:border-primary-red focus:outline-none w-full"
                                        >
                                            <option value="">-- Class A Team 1 --</option>
                                            {aTeamsList.map(team => (
                                                <option key={team.id} value={team.id}>{team.name}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={adminPicks.aTeams[1] || ''}
                                            onChange={(e) => {
                                                const val = e.target.value || null;
                                                setAdminPicks(prev => ({
                                                    ...prev,
                                                    aTeams: [prev.aTeams[0], val]
                                                }));
                                            }}
                                            className="bg-carbon-black border border-accent-gray rounded px-3 py-1.5 text-pure-white text-xs focus:border-primary-red focus:outline-none w-full"
                                        >
                                            <option value="">-- Class A Team 2 --</option>
                                            {aTeamsList.map(team => (
                                                <option key={team.id} value={team.id}>{team.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Class B Team */}
                                <div className="p-4 bg-carbon-black/40 rounded-xl border border-pure-white/5 space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-green-500">Class B Team (Select 1)</h4>
                                    <select
                                        value={adminPicks.bTeam || ''}
                                        onChange={(e) => {
                                            const val = e.target.value || null;
                                            setAdminPicks(prev => ({
                                                ...prev,
                                                bTeam: val
                                            }));
                                        }}
                                        className="bg-carbon-black border border-accent-gray rounded px-3 py-1.5 text-pure-white text-xs focus:border-primary-red focus:outline-none w-full"
                                    >
                                        <option value="">-- Class B Team --</option>
                                        {bTeamsList.map(team => (
                                            <option key={team.id} value={team.id}>{team.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Fastest Lap Extra */}
                                <div className="p-4 bg-carbon-black/40 rounded-xl border border-pure-white/5 space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">Fastest Lap Driver</h4>
                                    <select
                                        value={adminPicks.fastestLap || ''}
                                        onChange={(e) => {
                                            const val = e.target.value || null;
                                            setAdminPicks(prev => ({
                                                ...prev,
                                                fastestLap: val
                                            }));
                                        }}
                                        className="bg-carbon-black border border-accent-gray rounded px-3 py-1.5 text-pure-white text-xs focus:border-primary-red focus:outline-none w-full"
                                    >
                                        <option value="">-- Select Driver --</option>
                                        {allDrivers.filter(d => d.isActive).map(driver => (
                                            <option key={driver.id} value={driver.id}>{driver.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Drivers Rows */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Class A Drivers */}
                                <div className="p-4 bg-carbon-black/40 rounded-xl border border-pure-white/5 space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary-red">Class A Drivers (Select 3)</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {[0, 1, 2].map(idx => (
                                            <select
                                                key={idx}
                                                value={adminPicks.aDrivers[idx] || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value || null;
                                                    setAdminPicks(prev => {
                                                        const arr = [...prev.aDrivers];
                                                        arr[idx] = val;
                                                        return { ...prev, aDrivers: arr };
                                                    });
                                                }}
                                                className="bg-carbon-black border border-accent-gray rounded px-3 py-1.5 text-pure-white text-xs focus:border-primary-red focus:outline-none w-full"
                                            >
                                                <option value="">-- Driver {idx + 1} --</option>
                                                {aDriversList.map(driver => (
                                                    <option key={driver.id} value={driver.id}>{driver.name}</option>
                                                ))}
                                            </select>
                                        ))}
                                    </div>
                                </div>

                                {/* Class B Drivers */}
                                <div className="p-4 bg-carbon-black/40 rounded-xl border border-pure-white/5 space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-green-500">Class B Drivers (Select 2)</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {[0, 1].map(idx => (
                                            <select
                                                key={idx}
                                                value={adminPicks.bDrivers[idx] || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value || null;
                                                    setAdminPicks(prev => {
                                                        const arr = [...prev.bDrivers];
                                                        arr[idx] = val;
                                                        return { ...prev, bDrivers: arr };
                                                    });
                                                }}
                                                className="bg-carbon-black border border-accent-gray rounded px-3 py-1.5 text-pure-white text-xs focus:border-primary-red focus:outline-none w-full"
                                            >
                                                <option value="">-- Driver {idx + 1} --</option>
                                                {bDriversList.map(driver => (
                                                    <option key={driver.id} value={driver.id}>{driver.name}</option>
                                                ))}
                                            </select>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={handleAdminSubmitPicks}
                                    disabled={isSubmittingPicks}
                                    className="bg-primary-red hover:bg-red-600 text-pure-white font-bold py-2.5 px-6 rounded-lg text-sm disabled:opacity-50 transition-all shadow-lg shadow-primary-red/20 uppercase tracking-wide cursor-pointer flex items-center gap-2"
                                >
                                    {isSubmittingPicks && (
                                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                    )}
                                    <span>{isSubmittingPicks ? 'Saving Override Picks...' : 'Submit Override Picks'}</span>
                                </button>
                            </div>
                        </div>
                    )}
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
                cancelledEventIds={cancelledEventIds}
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
