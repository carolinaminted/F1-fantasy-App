
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
import { Tile, SectionHeader, Banner, Chip, EventSelector } from './ui/index.ts';
import { ConfirmModal, Toggle } from './admin/index.ts';

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
        // The toggle is already disabled for your own account; refuse here too, so a stale
        // render or a future caller can't lock the signed-in admin out of the admin surface.
        if (auth.currentUser?.uid === targetUser.id) {
            showToast("You can't change your own admin access.", 'error');
            return;
        }
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
    // An admin removing their own access would lock themselves out of this very page.
    const isSelf = auth.currentUser?.uid === targetUser.id;
    const adminDirty = isAdminState !== !!targetUser.isAdmin;
    const duesDirty = (isDuesPaidState ? 'Paid' : 'Unpaid') !== (targetUser.duesPaidStatus || 'Unpaid');

    const bDriversList = allDrivers.filter(d => d.class === EntityClass.B && d.isActive);
    const aTeamsList = allConstructors.filter(c => c.class === EntityClass.A && c.isActive);
    const bTeamsList = allConstructors.filter(c => c.class === EntityClass.B && c.isActive);

    return (
        <div>
            {/* Account settings */}
            <Tile padding="md" className="mb-6">
                <SectionHeader
                    title="Account"
                    subtitle="Admin access and dues for this member"
                    icon={AdminIcon}
                />

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="rounded-xl border border-pure-white/10 bg-carbon-black/40 p-4">
                        <Toggle
                            checked={isAdminState}
                            onChange={setIsAdminState}
                            label="League admin"
                            description="Can enter results, manage members, and pause the league."
                            disabled={isSelf}
                            disabledReason="You can't change your own admin access."
                            tone="danger"
                        />
                        {/*
                          The Save button used to appear only once a value changed, so a
                          half-finished change looked identical to a saved one. It is always
                          here now, and simply disables when there is nothing to save.
                        */}
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-pure-white/5 pt-3">
                            <span className="text-[11px] text-highlight-silver">
                                {adminDirty ? 'Not saved yet' : 'Saved'}
                            </span>
                            <button
                                onClick={handleSaveAdminStatus}
                                disabled={isSavingAdmin || !adminDirty || isSelf}
                                className="rounded-lg bg-primary-red px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-pure-white transition-colors hover:bg-red-600 disabled:opacity-40"
                            >
                                {isSavingAdmin ? 'Saving\u2026' : 'Save'}
                            </button>
                        </div>
                    </div>

                    <div className="rounded-xl border border-pure-white/10 bg-carbon-black/40 p-4">
                        <Toggle
                            checked={isDuesPaidState}
                            onChange={setIsDuesPaidState}
                            label="Dues paid"
                            description="Marks this member as having paid their entry fee for the season."
                        />
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-pure-white/5 pt-3">
                            <span className="text-[11px] text-highlight-silver">
                                {duesDirty ? 'Not saved yet' : 'Saved'}
                            </span>
                            <button
                                onClick={handleSaveDuesStatus}
                                disabled={isSavingDues || !duesDirty}
                                className="rounded-lg bg-green-600 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-pure-white transition-colors hover:bg-green-500 disabled:opacity-40"
                            >
                                {isSavingDues ? 'Saving\u2026' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            </Tile>

            {/* Submit Picks on Behalf of User */}
            <div className="bg-carbon-fiber border border-pure-white/10 rounded-xl p-6 mb-6 space-y-6 shadow-xl">
                <div className="mb-4 border-b border-pure-white/10 pb-4">
                    <h3 className="text-xl font-bold text-pure-white">
                        Make picks for {targetUser.displayName}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-highlight-silver">
                        Enter or change this member's lineup for a race on their behalf. This works
                        even after picks have closed, so use it to fix a genuine mistake rather than
                        to give someone extra time.
                    </p>
                </div>

                <div className="space-y-4">
                    {/* Event Selector */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-highlight-silver">Select Event</label>
                        <EventSelector
                            events={events}
                            selectedEventId={selectedEventId || null}
                            onSelect={(ev) => setSelectedEventId(ev.id)}
                            placeholder="Choose a race…"
                            raceResults={raceResults}
                            cancelledEventIds={cancelledEventIds}
                            orderBy="upcoming-first"
                            renderStatus={(ev) => (
                                <Chip
                                    label={seasonPicks[ev.id] ? 'Picks in' : 'No picks'}
                                    tone={seasonPicks[ev.id] ? 'success' : 'neutral'}
                                    size="xs"
                                />
                            )}
                        />
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
                                    <span>{isSubmittingPicks ? 'Saving\u2026' : `Save picks for ${targetUser.displayName}`}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Banner
                tone="neutral"
                title={`Viewing as ${targetUser.displayName}`}
                message="This is their profile exactly as they see it, plus admin penalty controls on each race."
                className="mb-6 rounded-xl border-b-0 ring-1 ring-pure-white/10"
            />
            
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

            <div className="mt-8 overflow-hidden rounded-xl border border-primary-red/30 bg-primary-red/[0.06]">
                <div className="flex items-center gap-2 border-b border-primary-red/20 px-5 py-3">
                    <TrashIcon className="w-5 h-5 text-primary-red" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-primary-red">
                        Permanent actions
                    </h3>
                </div>
                <div className="flex flex-col items-start justify-between gap-4 p-5 md:flex-row md:items-center">
                    <div>
                        <h4 className="text-sm font-bold text-pure-white">
                            Delete this member's data
                        </h4>
                        <p className="mt-1 max-w-md text-xs leading-relaxed text-highlight-silver">
                            Removes their profile, their standings entry, and every pick they have
                            made. Their invitation code goes back to unused so someone else can
                            join with it. This cannot be undone.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowPurgeModal(true)}
                        className="whitespace-nowrap rounded-lg border border-primary-red/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-primary-red transition-colors hover:bg-primary-red hover:text-pure-white"
                    >
                        Delete member
                    </button>
                </div>
            </div>

            <ConfirmModal
                isOpen={showPurgeModal}
                onClose={() => setShowPurgeModal(false)}
                onConfirm={handleConfirmPurge}
                title="Delete this member's data"
                consequence={
                    <>
                        This permanently removes{' '}
                        <strong className="text-pure-white">{targetUser.displayName}</strong>, their
                        standings entry, and every pick they have made. Their invitation code is
                        released so it can be used again. This cannot be undone.
                    </>
                }
                confirmLabel="Delete member"
                typedGuard={targetUser.displayName}
                busy={isPurging}
                busyLabel="Deleting\u2026"
            />
        </div>
    );
};

export default AdminUserProfileView;
