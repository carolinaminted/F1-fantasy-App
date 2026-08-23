import React, { useState, useEffect } from 'react';
import { User } from '../types.ts';
import { SpeakerphoneIcon } from './icons/SpeakerphoneIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { useMaintenanceMode } from '../hooks/useMaintenanceMode.ts';
import { useResultsAnnouncement } from '../hooks/useResultsAnnouncement.ts';
import { useGeneralAnnouncement } from '../hooks/useGeneralAnnouncement.ts';
import { setMaintenanceMode, triggerResultsAnnouncement, clearResultsAnnouncement, triggerGeneralAnnouncement, clearGeneralAnnouncement } from '../services/firestoreService.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { auth } from '../services/firebase.ts';
import { EVENTS } from '../constants.ts';
import { Countdown, SegmentedControl, Chip, type Segment } from './ui/index.ts';
import { AdminToolShell, ConfirmModal } from './admin/index.ts';
import type { AdminDestination } from '../routes.ts';

interface AdminAnnouncementsPageProps {
    setAdminSubPage: (page: AdminDestination) => void;
    user: User | null;
}

type AnnouncementTab = 'maintenance' | 'results' | 'general';

const TABS: Segment<AnnouncementTab>[] = [
    { value: 'maintenance', label: 'Pause the league', icon: AdminIcon },
    { value: 'results', label: 'Results are in', icon: TrophyIcon },
    { value: 'general', label: 'Message everyone', icon: SpeakerphoneIcon },
];

const AdminAnnouncementsPage: React.FC<AdminAnnouncementsPageProps> = ({ setAdminSubPage, user }) => {
    const [activeTab, setActiveTab] = useState<AnnouncementTab>('maintenance');
    const { showToast } = useToast();

    // Maintenance State
    const { maintenance } = useMaintenanceMode();
    const [maintenanceMsg, setMaintenanceMsg] = useState('');

    // Results State
    const { announcement } = useResultsAnnouncement(user);
    const [announcementEventId, setAnnouncementEventId] = useState<string>(EVENTS[0]?.id || '');
    const [announcementMessage, setAnnouncementMessage] = useState('');
    const [isAnnouncing, setIsAnnouncing] = useState(false);

    // General Announcement State
    const { announcement: generalAnnouncement } = useGeneralAnnouncement(user);
    const [generalMessage, setGeneralMessage] = useState('');
    const [isGeneralAnnouncing, setIsGeneralAnnouncing] = useState(false);
    const [showRedFlagConfirm, setShowRedFlagConfirm] = useState(false);
    const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false);

    useEffect(() => {
        if (maintenance) {
            setMaintenanceMsg(maintenance.message || '');
        }
    }, [maintenance]);

    const toggleMaintenance = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        setShowRedFlagConfirm(false);
        setIsTogglingMaintenance(true);
        const newState = !maintenance?.enabled;
        try {
            await setMaintenanceMode(newState, currentUser.uid, maintenanceMsg);
            if (newState) {
                showToast("🔴 RED FLAG deployed", 'error');
            } else {
                showToast("🟢 Green flag — session live", 'success');
            }
        } catch (error) {
            console.error("Maintenance toggle failed", error);
            showToast("Failed to toggle maintenance mode", 'error');
        } finally {
            setIsTogglingMaintenance(false);
        }
    };

    /* Saving the public message on its own — it used to only persist as a side effect of
       toggling, so editing it while paused appeared to do nothing. */
    const saveMaintenanceMessage = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        setIsTogglingMaintenance(true);
        try {
            await setMaintenanceMode(true, currentUser.uid, maintenanceMsg);
            showToast("Message updated", 'success');
        } catch (error) {
            console.error("Failed to update maintenance message", error);
            showToast("Failed to update the message", 'error');
        } finally {
            setIsTogglingMaintenance(false);
        }
    };

    const handleAnnounceResults = async () => {
        if (!user || !announcementEventId) return;
        const event = EVENTS.find(e => e.id === announcementEventId);
        if (!event) return;

        setIsAnnouncing(true);
        try {
            await triggerResultsAnnouncement(user.id, event.id, event.name, announcementMessage.trim());
            showToast(`Results announcement for ${event.name} is now LIVE!`, 'success');
            setAnnouncementMessage('');
        } catch (error) {
            console.error("Failed to trigger announcement:", error);
            showToast("Error: Could not trigger announcement.", 'error');
        } finally {
            setIsAnnouncing(false);
        }
    };

    const handleClearAnnouncement = async () => {
        if (!user) return;

        setIsAnnouncing(true);
        try {
            await clearResultsAnnouncement(user.id);
            showToast(`Announcement cleared successfully.`, 'success');
        } catch (error) {
            console.error("Failed to clear announcement:", error);
            showToast("Error: Could not clear announcement.", 'error');
        } finally {
            setIsAnnouncing(false);
        }
    };

    const handleGeneralAnnounce = async () => {
        if (!user || !generalMessage.trim()) return;

        setIsGeneralAnnouncing(true);
        try {
            await triggerGeneralAnnouncement(user.id, generalMessage.trim());
            showToast(`General announcement is now LIVE!`, 'success');
            setGeneralMessage('');
        } catch (error) {
            console.error("Failed to trigger general announcement:", error);
            showToast("Error: Could not trigger announcement.", 'error');
        } finally {
            setIsGeneralAnnouncing(false);
        }
    };

    const handleClearGeneralAnnouncement = async () => {
        if (!user) return;

        setIsGeneralAnnouncing(true);
        try {
            await clearGeneralAnnouncement(user.id);
            showToast(`General announcement cleared.`, 'success');
        } catch (error) {
            console.error("Failed to clear general announcement:", error);
            showToast("Error: Could not clear announcement.", 'error');
        } finally {
            setIsGeneralAnnouncing(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto text-pure-white h-full flex flex-col">
            <AdminToolShell
                title="ANNOUNCEMENTS"
                icon={SpeakerphoneIcon}
                subtitle="Tell the league something, or pause it for maintenance"
                setAdminSubPage={setAdminSubPage}
            />

            <div className="flex-1 overflow-y-auto no-scrollbar px-2 md:px-0 pb-24 md:pb-8">
                {/*
                  This bar used to be hidden below md, so a phone got three stacked panels
                  and no tabs — a different information architecture per breakpoint. One
                  control now, at every width.
                */}
                <div className="mb-6">
                    <SegmentedControl
                        segments={TABS}
                        value={activeTab}
                        onChange={v => setActiveTab(v)}
                        scrollable
                        size="sm"
                    />
                </div>

                <div className="rounded-2xl border border-pure-white/10 bg-carbon-fiber shadow-2xl">
                    {activeTab === 'maintenance' && (
                        <div className="w-full p-6 md:p-8">
                            <div className="mb-6 flex flex-col items-center gap-4 text-center md:flex-row md:items-start md:text-left">
                                <div className={`shrink-0 rounded-full p-4 ${maintenance?.enabled ? 'bg-primary-red text-white' : 'border border-pure-white/10 bg-carbon-black text-highlight-silver'}`}>
                                    <AdminIcon className="h-8 w-8" />
                                </div>
                                <div>
                                    <div className="flex items-center justify-center gap-2 md:justify-start">
                                        <h2 className={`text-2xl font-black uppercase tracking-wider ${maintenance?.enabled ? 'text-primary-red' : 'text-pure-white'}`}>
                                            {maintenance?.enabled ? 'League paused' : 'League running'}
                                        </h2>
                                        <Chip
                                            label={maintenance?.enabled ? 'Red flag' : 'Green flag'}
                                            tone={maintenance?.enabled ? 'danger' : 'success'}
                                            size="xs"
                                        />
                                    </div>
                                    <p className="mt-1 text-sm leading-relaxed text-highlight-silver">
                                        {maintenance?.enabled
                                            ? 'Members cannot sign in. They see a maintenance screen with your message below. You and other admins still have full access.'
                                            : 'Everyone can sign in and use the app as normal. Pausing is for when you need to fix data without members seeing it half-done.'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">
                                        What members will see (optional)
                                    </label>
                                    <textarea
                                        placeholder="e.g. We're adding the Australian GP results \u2014 back in about ten minutes."
                                        value={maintenanceMsg}
                                        onChange={e => setMaintenanceMsg(e.target.value)}
                                        className="min-h-[110px] w-full resize-none rounded-xl border border-pure-white/15 bg-carbon-black p-4 text-sm text-pure-white focus:border-primary-red focus:outline-none"
                                    />
                                    {maintenance?.enabled && (
                                        <button
                                            onClick={saveMaintenanceMessage}
                                            disabled={isTogglingMaintenance}
                                            className="mt-2 rounded-lg border border-pure-white/15 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-pure-white transition-colors hover:bg-pure-white/10 disabled:opacity-40"
                                        >
                                            Update the message
                                        </button>
                                    )}
                                </div>

                                <button
                                    onClick={() => maintenance?.enabled ? toggleMaintenance() : setShowRedFlagConfirm(true)}
                                    disabled={isTogglingMaintenance}
                                    className={`flex w-full items-center justify-center gap-3 rounded-xl py-4 text-sm font-black uppercase tracking-widest transition-colors disabled:opacity-50 ${
                                        maintenance?.enabled
                                            ? 'bg-green-600 text-white hover:bg-green-500'
                                            : 'bg-primary-red text-white hover:bg-red-600'
                                    }`}
                                >
                                    {maintenance?.enabled ? 'Let members back in' : 'Pause the league'}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'results' && (
                        <div className="w-full p-6 md:p-8">
                            <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-4 mb-8">
                                <div className={`p-4 rounded-full ${announcement?.active ? 'bg-green-500 text-white animate-pulse shadow-[0_0_30px_rgba(34,197,94,0.4)]' : 'bg-carbon-black text-highlight-silver border border-pure-white/10'}`}>
                                    <TrophyIcon className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className={`text-2xl font-black uppercase tracking-wider ${announcement?.active ? 'text-green-500' : 'text-pure-white'}`}>
                                        {announcement?.active ? 'RESULTS ANNOUNCEMENT LIVE' : 'NEW RESULTS ANNOUNCEMENT'}
                                    </h2>
                                    <p className="text-sm text-highlight-silver opacity-80 mt-1">
                                        {announcement?.active ? `Currently notifying users about ${announcement.eventName}.` : 'Trigger a banner notification to all users that new results are posted.'}
                                    </p>
                                </div>
                            </div>

                            {announcement?.active ? (
                                <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6 mb-6 text-center md:text-left">
                                    <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-2">
                                        <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Active Event</span>
                                        {announcement.expiresAt?.toDate && (
                                            <div className="text-xs flex items-center gap-1.5 text-highlight-silver/70">
                                                <span>Expires in:</span>
                                                <Countdown targetDate={announcement.expiresAt.toDate().toISOString()} expiredLabel="Expired" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xl font-bold text-pure-white mb-2">{announcement.eventName}</p>
                                    {announcement.message && <p className="text-sm text-highlight-silver italic">"{announcement.message}"</p>}
                                    
                                    <button 
                                        onClick={handleClearAnnouncement}
                                        disabled={isAnnouncing}
                                        className="mt-6 w-full bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-widest transition-colors"
                                    >
                                        {isAnnouncing ? 'Clearing...' : 'Clear Announcement Early'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-highlight-silver uppercase tracking-widest mb-2 text-center md:text-left">Select Grand Prix</label>
                                        <select 
                                            value={announcementEventId} 
                                            onChange={e => setAnnouncementEventId(e.target.value)} 
                                            className="w-full bg-carbon-black border border-accent-gray rounded-xl p-4 text-sm text-pure-white focus:border-green-500 outline-none appearance-none cursor-pointer text-center md:text-left"
                                        >
                                            {EVENTS.map(e => <option key={e.id} value={e.id}>Round {e.round}: {e.name}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-highlight-silver uppercase tracking-widest mb-2 text-center md:text-left">Custom Message (Optional)</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g., Sprint results are now final!"
                                            value={announcementMessage}
                                            onChange={(e) => setAnnouncementMessage(e.target.value)}
                                            className="w-full bg-carbon-black border border-accent-gray rounded-xl p-4 text-sm text-pure-white focus:border-green-500 outline-none"
                                        />
                                    </div>
                                    
                                    <button 
                                        onClick={handleAnnounceResults}
                                        disabled={isAnnouncing}
                                        className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg bg-green-600 hover:bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                                    >
                                        {isAnnouncing ? 'Announcing...' : 'Publish Announcement'}
                                    </button>
                                </div>
                            )}
                        </div>

                    )}

                    {activeTab === 'general' && (
                        <div className="w-full p-6 md:p-8">
                            <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-4 mb-8">
                                <div className={`p-4 rounded-full ${generalAnnouncement?.active ? 'bg-indigo-500 text-white' : 'bg-carbon-black text-highlight-silver border border-pure-white/10'}`}>
                                    <SpeakerphoneIcon className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className={`text-2xl font-black uppercase tracking-wider ${generalAnnouncement?.active ? 'text-indigo-300' : 'text-pure-white'}`}>
                                        {generalAnnouncement?.active ? 'GENERAL ANNOUNCEMENT LIVE' : 'LEAGUE ANNOUNCEMENT'}
                                    </h2>
                                    <p className="text-sm text-highlight-silver opacity-80 mt-1">
                                        {generalAnnouncement?.active ? 'Currently notifying users with a general message.' : 'Post an official message to the league as a notification.'}
                                    </p>
                                </div>
                            </div>

                            {generalAnnouncement?.active ? (
                                <div className="bg-indigo-500/10 border border-indigo-500/40 rounded-xl p-6 mb-6 text-center md:text-left">
                                    <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-2">
                                        <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Active Message</span>
                                        {generalAnnouncement.expiresAt?.toDate && (
                                            <div className="text-xs flex items-center gap-1.5 text-highlight-silver/70">
                                                <span>Expires in:</span>
                                                <Countdown targetDate={generalAnnouncement.expiresAt.toDate().toISOString()} expiredLabel="Expired" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-lg font-bold text-pure-white mb-2 italic">"{generalAnnouncement.message}"</p>
                                    
                                    <button 
                                        onClick={handleClearGeneralAnnouncement}
                                        disabled={isGeneralAnnouncing}
                                        className="mt-6 w-full bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-widest transition-colors"
                                    >
                                        {isGeneralAnnouncing ? 'Clearing...' : 'Clear Announcement Early'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-highlight-silver uppercase tracking-widest mb-2 text-center md:text-left">Announcement Text</label>
                                        <textarea 
                                            placeholder="Enter your official league announcement here..."
                                            value={generalMessage}
                                            onChange={(e) => setGeneralMessage(e.target.value)}
                                            className="w-full bg-carbon-black border border-accent-gray rounded-xl p-4 text-sm text-pure-white focus:border-primary-red outline-none min-h-[120px] resize-none"
                                        />
                                    </div>
                                    
                                    <button 
                                        onClick={handleGeneralAnnounce}
                                        disabled={isGeneralAnnouncing}
                                        className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-colors bg-primary-red hover:bg-red-600 text-pure-white"
                                    >
                                        {isGeneralAnnouncing ? 'Posting...' : 'Post Announcement'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={showRedFlagConfirm}
                onClose={() => setShowRedFlagConfirm(false)}
                onConfirm={toggleMaintenance}
                title="Pause the league"
                consequence="Every member is signed out of the app and cannot get back in until you let them back in. They will see a maintenance screen with your message. You and other admins keep full access."
                confirmLabel="Pause the league"
                busy={isTogglingMaintenance}
                busyLabel="Pausing\u2026"
            />
        </div>
    );
};

export default AdminAnnouncementsPage;
