import React, { useState, useEffect, useMemo } from 'react';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { TeamIcon } from './icons/TeamIcon.tsx';
import { TrackIcon } from './icons/TrackIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { TicketIcon } from './icons/TicketIcon.tsx';
import { SyncIcon } from './icons/SyncIcon.tsx';
import { DuesIcon } from './icons/DuesIcon.tsx';
import { SpeakerphoneIcon } from './icons/SpeakerphoneIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { LockIcon } from './icons/LockIcon.tsx';
import {
    PageHeader, Tile, StatTile, SectionHeader, Modal, Chip, Countdown, NUMERIC,
} from './ui/index.ts';
import { ConfirmModal } from './admin/index.ts';
import { triggerManualLeaderboardSync, getLeagueConfig, saveLeagueConfig } from '../services/firestoreService.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { parseLeagueDate } from '../utils/dateUtils.ts';
import { User, RaceResults, Event } from '../types.ts';
import type { AdminDestination } from '../routes.ts';

interface AdminPageProps {
    setAdminSubPage: (page: AdminDestination) => void;
    user: User | null;
    /** Everything below is already loaded by App — the status strip adds no Firestore reads. */
    events: Event[];
    raceResults: RaceResults;
    cancelledEventIds: Set<string>;
    maintenanceOn: boolean;
}

interface ToolDef {
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    title: string;
    description: string;
    tool: AdminDestination;
    badge?: React.ReactNode;
}

/**
 * Admin Home.
 *
 * Was a flat grid of seven tiles labelled with internal taxonomy — "Entities",
 * "Onboarding", "Race Control" — which told you which part of the system a tool belonged
 * to rather than what you would do there. Now the tiles are grouped by the job at hand and
 * described as verbs, and the page opens by answering the question an admin actually
 * arrives with: is anything waiting for me?
 *
 * The status strip derives entirely from props App already holds. No new reads.
 */
const AdminPage: React.FC<AdminPageProps> = ({
    setAdminSubPage, user, events, raceResults, cancelledEventIds, maintenanceOn,
}) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [showSyncConfirm, setShowSyncConfirm] = useState(false);
    const { showToast } = useToast();

    const [showDuesModal, setShowDuesModal] = useState(false);
    const [currentDuesAmount, setCurrentDuesAmount] = useState<number>(25);
    const [isSavingDues, setIsSavingDues] = useState(false);

    useEffect(() => {
        const loadDues = async () => {
            try {
                const config = await getLeagueConfig();
                setCurrentDuesAmount(config.duesAmount);
            } catch (e) {
                console.error(e);
            }
        };
        loadDues();
    }, []);

    /* --------------------------------------------------------- status, from props */

    const { nextEvent, awaitingResults } = useMemo(() => {
        const now = Date.now();
        const live = events.filter(e => !cancelledEventIds.has(e.id));

        const upcoming = live
            .filter(e => {
                const lock = parseLeagueDate(e.lockAtUtc);
                return lock ? lock.getTime() > now : false;
            })
            .sort((a, b) => (parseLeagueDate(a.lockAtUtc)?.getTime() ?? 0) - (parseLeagueDate(b.lockAtUtc)?.getTime() ?? 0));

        // A race whose picks have already locked but has no results entered is the one
        // thing on this page that represents work waiting for the admin.
        const pending = live.filter(e => {
            const lock = parseLeagueDate(e.lockAtUtc);
            if (!lock || lock.getTime() > now) return false;
            return !raceResults[e.id];
        });

        return { nextEvent: upcoming[0] ?? null, awaitingResults: pending };
    }, [events, raceResults, cancelledEventIds]);

    /* --------------------------------------------------------------------- actions */

    const executeSync = async () => {
        setShowSyncConfirm(false);
        setIsSyncing(true);
        try {
            const result = await triggerManualLeaderboardSync();
            if (result.success) {
                showToast(`League Sync Complete! ${result.usersProcessed} users recalculated.`, 'success');
            } else {
                throw new Error("Sync operation returned success:false");
            }
        } catch (error: any) {
            console.error("[AdminPage] Manual Sync Error:", error);
            const message = error.message || "Internal server error";
            showToast(`Sync failed: ${message}`, 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSaveDues = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingDues(true);
        try {
            await saveLeagueConfig({ duesAmount: Number(currentDuesAmount) });
            showToast(`Dues amount updated to $${currentDuesAmount}`, 'success');
            setShowDuesModal(false);
        } catch (error) {
            console.error(error);
            showToast("Failed to save dues amount.", 'error');
        } finally {
            setIsSavingDues(false);
        }
    };

    /* ----------------------------------------------------------------------- tools */

    const GROUPS: { title: string; subtitle: string; tools: ToolDef[] }[] = [
        {
            title: 'Race Weekend',
            subtitle: 'What you do around each Grand Prix',
            tools: [
                {
                    icon: TrackIcon,
                    title: 'Enter Race Results',
                    description: 'Type in the finishing order, then open or close the pick form for a race.',
                    tool: 'results',
                    badge: awaitingResults.length > 0
                        ? <Chip label={`${awaitingResults.length} waiting`} tone="warning" size="xs" />
                        : undefined,
                },
                {
                    icon: CalendarIcon,
                    title: 'Race Schedule',
                    description: 'Set race dates, session times, and when picks stop being accepted.',
                    tool: 'schedule',
                },
            ],
        },
        {
            title: 'People',
            subtitle: 'Members and how they join',
            tools: [
                {
                    icon: ProfileIcon,
                    title: 'Members',
                    description: 'Find a member, mark their dues paid, or edit their picks for them.',
                    tool: 'manage-users',
                },
                {
                    icon: TicketIcon,
                    title: 'Invite Codes',
                    description: 'Create codes for new members and see which ones have been used.',
                    tool: 'invitations',
                },
            ],
        },
        {
            title: 'League Setup',
            subtitle: 'Set once, change rarely',
            tools: [
                {
                    icon: TeamIcon,
                    title: 'Drivers & Teams',
                    description: 'Add or retire drivers, move them between teams, and set Class A or B.',
                    tool: 'entities',
                },
                {
                    icon: TrophyIcon,
                    title: 'Scoring Rules',
                    description: 'Change how many points each finishing position is worth.',
                    tool: 'scoring',
                },
            ],
        },
        {
            title: 'Announcements',
            subtitle: 'Talking to the league',
            tools: [
                {
                    icon: SpeakerphoneIcon,
                    title: 'Announcements & Red Flag',
                    description: 'Post a message to everyone, or pause the league for maintenance.',
                    tool: 'announcements',
                    badge: maintenanceOn
                        ? <Chip label="League paused" tone="danger" size="xs" />
                        : undefined,
                },
            ],
        },
    ];

    return (
        <div className="w-full max-w-5xl mx-auto px-2 md:px-0 pb-20 md:pb-12">
            <PageHeader
                title="ADMIN"
                icon={AdminIcon}
                subtitle={`Signed in as ${user?.displayName || 'admin'}`}
                onIconClick={() => setAdminSubPage('database')}
                rightAction={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowDuesModal(true)}
                            className="flex items-center gap-2 rounded-lg border border-pure-white/15 bg-carbon-black/60 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-highlight-silver transition-colors hover:border-pure-white/30 hover:text-pure-white"
                        >
                            <DuesIcon className="w-4 h-4" />
                            <span>Dues amount</span>
                        </button>
                        <button
                            onClick={() => !isSyncing && setShowSyncConfirm(true)}
                            disabled={isSyncing}
                            className="flex items-center gap-2 rounded-lg border border-primary-red/50 bg-carbon-black/60 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-primary-red transition-colors hover:bg-primary-red hover:text-pure-white disabled:cursor-wait disabled:opacity-60"
                        >
                            <SyncIcon className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                            <span>{isSyncing ? 'Recalculating…' : 'Recalculate scores'}</span>
                        </button>
                    </div>
                }
            />

            <div className="px-2">
                {/* Status: the question an admin arrives with is "is anything waiting for me?" */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                    <StatTile
                        label="League Status"
                        value={maintenanceOn ? 'Paused' : 'Live'}
                        icon={maintenanceOn ? LockIcon : CheckeredFlagIcon}
                        deltaLabel={maintenanceOn ? "Members can't sign in" : 'Members can sign in'}
                    />
                    <StatTile
                        label="Results Waiting"
                        value={awaitingResults.length}
                        unit={awaitingResults.length === 1 ? 'race' : 'races'}
                        icon={TrackIcon}
                        deltaLabel={
                            awaitingResults.length > 0
                                ? awaitingResults.map(e => e.name).slice(0, 2).join(', ')
                                : 'Every finished race is scored'
                        }
                    />
                    <Tile padding="md" className="col-span-2 lg:col-span-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-highlight-silver">
                            Next Race
                        </span>
                        {nextEvent ? (
                            <>
                                <span className="mt-1.5 block truncate text-lg font-black text-pure-white">
                                    {nextEvent.name}
                                </span>
                                <Countdown
                                    targetDate={nextEvent.lockAtUtc}
                                    label="Picks close in"
                                    size="sm"
                                    expiredLabel="Picks closed"
                                    className="mt-2"
                                />
                            </>
                        ) : (
                            <span className={`mt-1.5 block text-lg font-black text-pure-white ${NUMERIC}`}>
                                —
                                <span className="ml-2 text-[11px] font-medium uppercase tracking-wider text-highlight-silver">
                                    Season complete
                                </span>
                            </span>
                        )}
                    </Tile>
                </div>

                {GROUPS.map(group => (
                    <div key={group.title} className="mb-8">
                        <SectionHeader title={group.title} subtitle={group.subtitle} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {group.tools.map(t => (
                                <Tile
                                    key={t.title}
                                    padding="md"
                                    onClick={() => setAdminSubPage(t.tool)}
                                    className="group"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary-red/25 bg-primary-red/10 text-primary-red">
                                            <t.icon className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-base font-black text-pure-white">{t.title}</h3>
                                                {t.badge}
                                            </div>
                                            <p className="mt-1 text-xs leading-relaxed text-highlight-silver">
                                                {t.description}
                                            </p>
                                        </div>
                                    </div>
                                </Tile>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={showDuesModal}
                onClose={() => !isSavingDues && setShowDuesModal(false)}
                title="League dues amount"
                icon={DuesIcon}
                size="sm"
            >
                <p className="text-sm leading-relaxed text-highlight-silver">
                    What each member pays to enter this season. This is the figure shown on the
                    League page when someone goes to pay.
                </p>
                <form onSubmit={handleSaveDues} className="mt-5">
                    <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-bold text-highlight-silver">
                            $
                        </span>
                        <input
                            type="number" min="0" step="0.01" required
                            value={currentDuesAmount}
                            onChange={e => setCurrentDuesAmount(parseFloat(e.target.value))}
                            placeholder="25.00"
                            className={`w-full rounded-lg border border-pure-white/15 bg-carbon-black py-2.5 pl-8 pr-4 font-bold text-pure-white focus:border-primary-red focus:outline-none ${NUMERIC}`}
                        />
                    </div>
                    <div className="mt-5 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setShowDuesModal(false)}
                            disabled={isSavingDues}
                            className="rounded-lg border border-pure-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-highlight-silver transition-colors hover:text-pure-white disabled:opacity-40"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSavingDues}
                            className="rounded-lg bg-primary-red px-4 py-2 text-xs font-black uppercase tracking-wider text-pure-white transition-colors hover:bg-red-600 disabled:opacity-40"
                        >
                            {isSavingDues ? 'Saving…' : 'Save amount'}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                isOpen={showSyncConfirm}
                onClose={() => setShowSyncConfirm(false)}
                onConfirm={executeSync}
                title="Recalculate all scores"
                consequence="This re-scores every member across every race from the results currently entered. Nothing is lost — it just rebuilds the standings. It can take a minute."
                confirmLabel="Recalculate"
                tone="warning"
            />
        </div>
    );
};

export default AdminPage;
