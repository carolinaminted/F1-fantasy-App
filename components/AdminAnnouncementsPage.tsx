import React, { useState, useEffect } from 'react';
import { User } from '../types.ts';
import { PageHeader } from './ui/PageHeader.tsx';
import { BackIcon } from './icons/BackIcon.tsx';
import { SpeakerphoneIcon } from './icons/SpeakerphoneIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { useMaintenanceMode } from '../hooks/useMaintenanceMode.ts';
import { useResultsAnnouncement } from '../hooks/useResultsAnnouncement.ts';
import { setMaintenanceMode, triggerResultsAnnouncement, clearResultsAnnouncement } from '../services/firestoreService.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { auth } from '../services/firebase.ts';
import { EVENTS } from '../constants.ts';
import CountdownTimer from './CountdownTimer.tsx';

interface AdminAnnouncementsPageProps {
    setAdminSubPage: (page: 'dashboard' | 'results' | 'manage-users' | 'scoring' | 'entities' | 'schedule' | 'invitations' | 'database' | 'announcements') => void;
    user: User | null;
}

type AnnouncementTab = 'maintenance' | 'results' | 'general';

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

    // General Announcement State (Placeholder for future implementation)
    const [generalMessage, setGeneralMessage] = useState('');

    useEffect(() => {
        if (maintenance) {
            setMaintenanceMsg(maintenance.message || '');
        }
    }, [maintenance]);

    const toggleMaintenance = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        
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

    const handleGeneralAnnounce = () => {
        // Placeholder for general announcement logic
        showToast("General announcements coming soon!", 'info');
    };

    const DashboardAction = (
        <button 
            onClick={() => setAdminSubPage('dashboard')}
            className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10 hover:border-pure-white/30"
        >
            <BackIcon className="w-4 h-4" /> 
            <span className="text-sm font-bold">Dashboard</span>
        </button>
    );

    return (
        <div className="max-w-4xl mx-auto text-pure-white h-full flex flex-col">
            <div className="flex-none">
                <PageHeader 
                    title="ANNOUNCEMENTS" 
                    icon={SpeakerphoneIcon} 
                    leftAction={DashboardAction}
                />
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-2 md:px-0 pb-24 md:pb-8 mt-6">
                
                {/* Interactive Glass Filter Slider (Desktop Only) */}
                <div className="hidden md:flex relative bg-carbon-black/50 border border-pure-white/10 rounded-2xl p-2 mb-8 shadow-2xl backdrop-blur-md">
                    {/* Sliding Background Indicator */}
                    <div 
                        className="absolute top-2 bottom-2 w-[calc(33.333%-5.33px)] bg-pure-white/10 border border-pure-white/20 rounded-xl transition-transform duration-300 ease-in-out shadow-[0_0_15px_rgba(255,255,255,0.1)] backdrop-blur-lg"
                        style={{ 
                            transform: `translateX(${
                                activeTab === 'maintenance' ? '0%' : 
                                activeTab === 'results' ? '100%' : '200%'
                            })`,
                            marginLeft: activeTab === 'maintenance' ? '0' : activeTab === 'results' ? '8px' : '16px'
                        }}
                    />

                    {/* Tab Buttons */}
                    <button 
                        onClick={() => setActiveTab('maintenance')}
                        className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors ${activeTab === 'maintenance' ? 'text-pure-white' : 'text-highlight-silver hover:text-pure-white/80'}`}
                    >
                        <AdminIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Maintenance</span>
                    </button>
                    
                    <button 
                        onClick={() => setActiveTab('results')}
                        className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors ${activeTab === 'results' ? 'text-pure-white' : 'text-highlight-silver hover:text-pure-white/80'}`}
                    >
                        <TrophyIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Results</span>
                    </button>
                    
                    <button 
                        onClick={() => setActiveTab('general')}
                        className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors ${activeTab === 'general' ? 'text-pure-white' : 'text-highlight-silver hover:text-pure-white/80'}`}
                    >
                        <SpeakerphoneIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">General</span>
                    </button>
                </div>

                {/* Dynamic Form Content */}
                <style>{`
                    @media (min-width: 768px) {
                        .desktop-slider {
                            transform: translateX(${activeTab === 'maintenance' ? '0%' : activeTab === 'results' ? '-100%' : '-200%'});
                        }
                    }
                `}</style>
                <div className="relative md:overflow-hidden bg-carbon-fiber md:rounded-2xl md:border md:border-pure-white/10 md:shadow-2xl">
                    <div className="flex flex-col md:flex-row md:transition-transform md:duration-500 md:ease-in-out items-stretch desktop-slider gap-6 md:gap-0">
                        {/* Maintenance Form */}
                        <div className="w-full flex-shrink-0 p-6 md:p-8 bg-carbon-fiber rounded-2xl border border-pure-white/10 shadow-2xl md:bg-none md:rounded-none md:border-none md:shadow-none">
                            <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-4 mb-8">
                                <div className={`p-4 rounded-full ${maintenance?.enabled ? 'bg-primary-red text-white animate-pulse shadow-[0_0_30px_rgba(218,41,28,0.4)]' : 'bg-carbon-black text-highlight-silver border border-pure-white/10'}`}>
                                    <AdminIcon className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className={`text-2xl font-black uppercase tracking-wider ${maintenance?.enabled ? 'text-primary-red' : 'text-pure-white'}`}>
                                        {maintenance?.enabled ? 'RED FLAG ACTIVE' : 'RACE CONTROL: GREEN FLAG'}
                                    </h2>
                                    <p className="text-sm text-highlight-silver opacity-80 mt-1">
                                        {maintenance?.enabled ? 'App is locked for non-admins. Users see the maintenance screen.' : 'App is accessible to all users normally.'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-highlight-silver uppercase tracking-widest mb-2 text-center md:text-left">Public Message (Optional)</label>
                                    <textarea 
                                        placeholder="e.g., We are currently calculating points for the Australian GP..."
                                        value={maintenanceMsg}
                                        onChange={(e) => setMaintenanceMsg(e.target.value)}
                                        className="w-full bg-carbon-black border border-accent-gray rounded-xl p-4 text-sm text-pure-white focus:border-primary-red outline-none min-h-[120px] resize-none"
                                    />
                                </div>
                                
                                <button 
                                    onClick={toggleMaintenance}
                                    className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-3 ${
                                        maintenance?.enabled 
                                        ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]' 
                                        : 'bg-primary-red hover:bg-red-600 text-white shadow-[0_0_20px_rgba(218,41,28,0.3)]'
                                    }`}
                                >
                                    {maintenance?.enabled ? 'Resume Session (Green Flag)' : 'Deploy Red Flag'}
                                </button>
                            </div>
                        </div>

                        {/* Results Form */}
                        <div className="w-full flex-shrink-0 p-6 md:p-8 bg-carbon-fiber rounded-2xl border border-pure-white/10 shadow-2xl md:bg-none md:rounded-none md:border-none md:shadow-none">
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
                                                <CountdownTimer targetDate={announcement.expiresAt.toDate().toISOString()} />
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

                        {/* General Form */}
                        <div className="w-full flex-shrink-0 p-6 md:p-8 bg-carbon-fiber rounded-2xl border border-pure-white/10 shadow-2xl md:bg-none md:rounded-none md:border-none md:shadow-none">
                            <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-4 mb-8">
                                <div className="p-4 rounded-full bg-carbon-black text-highlight-silver border border-pure-white/10">
                                    <SpeakerphoneIcon className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black uppercase tracking-wider text-pure-white">
                                        LEAGUE ANNOUNCEMENT
                                    </h2>
                                    <p className="text-sm text-highlight-silver opacity-80 mt-1">
                                        Post an official message to the league as a notification
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-highlight-silver uppercase tracking-widest mb-2 text-center md:text-left">Announcement Text</label>
                                    <textarea 
                                        placeholder="Enter your official league announcement here..."
                                        value={generalMessage}
                                        onChange={(e) => setGeneralMessage(e.target.value)}
                                        className="w-full bg-carbon-black border border-accent-gray rounded-xl p-4 text-sm text-pure-white focus:border-blue-500 outline-none min-h-[120px] resize-none"
                                    />
                                </div>
                                
                                <button 
                                    onClick={handleGeneralAnnounce}
                                    className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                                >
                                    Post Announcement
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminAnnouncementsPage;
