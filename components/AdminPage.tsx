
import React, { useState, useEffect } from 'react';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { TeamIcon } from './icons/TeamIcon.tsx';
import { TrackIcon } from './icons/TrackIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { TicketIcon } from './icons/TicketIcon.tsx';
import { SyncIcon } from './icons/SyncIcon.tsx';
import { DuesIcon } from './icons/DuesIcon.tsx';
import { SaveIcon } from './icons/SaveIcon.tsx';
import { DatabaseIcon } from './icons/DatabaseIcon.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { triggerManualLeaderboardSync, getLeagueConfig, saveLeagueConfig, setMaintenanceMode } from '../services/firestoreService.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { useMaintenanceMode } from '../hooks/useMaintenanceMode.ts';
import { auth } from '../services/firebase.ts';

interface AdminPageProps {
    setAdminSubPage: (page: 'dashboard' | 'results' | 'manage-users' | 'scoring' | 'entities' | 'schedule' | 'invitations' | 'database') => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ setAdminSubPage }) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const { showToast } = useToast();
    const { maintenance } = useMaintenanceMode();

    // Dues Management State
    const [showDuesModal, setShowDuesModal] = useState(false);
    const [currentDuesAmount, setCurrentDuesAmount] = useState<number>(25);
    const [isSavingDues, setIsSavingDues] = useState(false);

    // Maintenance State
    const [maintenanceMsg, setMaintenanceMsg] = useState('');
    
    useEffect(() => {
        if (maintenance) {
            setMaintenanceMsg(maintenance.message || '');
        }
    }, [maintenance]);

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

    const handleManualSyncClick = () => {
        if (isSyncing) return;
        setShowConfirmModal(true);
    };

    const executeSync = async () => {
        setShowConfirmModal(false);
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

    const HeaderActions = (
        <div className="flex items-center gap-3">
            <button
                onClick={() => setShowDuesModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[10px] md:text-xs uppercase tracking-widest transition-all border shadow-lg backdrop-blur-md relative bg-carbon-black/60 border-green-500/50 text-green-500 hover:bg-green-600 hover:text-pure-white hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:scale-105 active:scale-95 cursor-pointer"
            >
                <DuesIcon className="w-4 h-4" />
                <span>Dues</span>
            </button>

            <button
                onClick={handleManualSyncClick}
                disabled={isSyncing}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all border shadow-lg backdrop-blur-md z-[60] relative ${
                    isSyncing 
                    ? 'bg-carbon-black/80 border-accent-gray text-highlight-silver cursor-wait' 
                    : 'bg-carbon-black/60 border-primary-red/50 text-primary-red hover:bg-primary-red hover:text-pure-white hover:shadow-[0_0_20px_rgba(218,41,28,0.4)] hover:scale-105 active:scale-95 cursor-pointer'
                }`}
            >
                <SyncIcon className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
            </button>
        </div>
    );

    return (
        <div className="w-full max-w-5xl mx-auto px-2 md:px-0">
            <PageHeader 
                title="ADMIN DASHBOARD" 
                icon={AdminIcon} 
                subtitle="League Controls & Configuration"
                rightAction={HeaderActions}
                onIconClick={() => setAdminSubPage('database')}
            />
            
            <div className="pb-20 md:pb-12 px-2">
                {/* Race Control Panel (Maintenance) */}
                <div className={`mb-6 p-4 rounded-xl border ${maintenance?.enabled ? 'bg-red-900/10 border-primary-red/50' : 'bg-carbon-fiber border-pure-white/10'} shadow-lg transition-colors`}>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${maintenance?.enabled ? 'bg-primary-red text-white animate-pulse' : 'bg-carbon-black text-highlight-silver border border-pure-white/10'}`}>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            <div>
                                <h3 className={`font-bold uppercase tracking-wider ${maintenance?.enabled ? 'text-primary-red' : 'text-pure-white'}`}>
                                    {maintenance?.enabled ? 'RED FLAG ACTIVE' : 'RACE CONTROL: GREEN FLAG'}
                                </h3>
                                <p className="text-xs text-highlight-silver opacity-80">
                                    {maintenance?.enabled ? 'App is locked for non-admins.' : 'App is accessible to all users.'}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <input 
                                type="text" 
                                placeholder="Public Message (Optional)"
                                value={maintenanceMsg}
                                onChange={(e) => setMaintenanceMsg(e.target.value)}
                                className="bg-carbon-black border border-accent-gray rounded-lg px-3 py-2 text-sm text-pure-white focus:border-primary-red outline-none flex-1 md:w-64"
                            />
                            <button 
                                onClick={toggleMaintenance}
                                className={`px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all shadow-lg ${
                                    maintenance?.enabled 
                                    ? 'bg-green-600 hover:bg-green-500 text-white' 
                                    : 'bg-primary-red hover:bg-red-600 text-white'
                                }`}
                            >
                                {maintenance?.enabled ? 'Resume Session' : 'Red Flag'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <AdminTile
                        icon={ProfileIcon}
                        title="Manage Users"
                        subtitle="Membership"
                        description="Search users, manage dues, and view profiles."
                        onClick={() => setAdminSubPage('manage-users')}
                        delay="0ms"
                    />
                    <AdminTile
                        icon={TrackIcon}
                        title="Results & Locks Manager"
                        subtitle="Race Control"
                        description="Enter race results and lock/unlock pick forms."
                        onClick={() => setAdminSubPage('results')}
                        delay="100ms"
                    />
                    <AdminTile
                        icon={CalendarIcon}
                        title="Schedule Manager"
                        subtitle="Calendar"
                        description="Set race dates, start times, and session details."
                        onClick={() => setAdminSubPage('schedule')}
                        delay="200ms"
                    />
                     <AdminTile
                        icon={TeamIcon}
                        title="Drivers & Teams"
                        subtitle="Entities"
                        description="Update the active grid, transfers, and classes."
                        onClick={() => setAdminSubPage('entities')}
                        delay="300ms"
                    />
                    <AdminTile
                        icon={TrophyIcon}
                        title="Scoring Settings"
                        subtitle="Rules"
                        description="Configure points awarded for race results."
                        onClick={() => setAdminSubPage('scoring')}
                        delay="400ms"
                    />
                    <AdminTile
                        icon={TicketIcon}
                        title="Invitation Codes"
                        subtitle="Onboarding"
                        description="Create and manage registration codes."
                        onClick={() => setAdminSubPage('invitations')}
                        delay="500ms"
                    />
                </div>
            </div>

            {/* Dues Management Modal */}
            {showDuesModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon-black/90 backdrop-blur-md p-4 animate-fade-in" onClick={() => !isSavingDues && setShowDuesModal(false)}>
                    <div className="bg-carbon-fiber border border-green-500/30 rounded-xl p-8 max-w-sm w-full shadow-[0_0_50px_rgba(34,197,94,0.1)] ring-1 ring-pure-white/10 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30">
                            <DuesIcon className="w-8 h-8 text-green-500" />
                        </div>
                        
                        <h2 className="text-xl font-bold text-pure-white mb-2 text-center">Configure League Dues</h2>
                        <p className="text-highlight-silver mb-6 text-sm text-center">
                            Set the entry fee amount for the current season. This amount will prepopulate on the payment page.
                        </p>
                        
                        <form onSubmit={handleSaveDues}>
                            <div className="relative mb-6">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-highlight-silver font-bold">$</span>
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={currentDuesAmount}
                                    onChange={(e) => setCurrentDuesAmount(parseFloat(e.target.value))}
                                    className="w-full bg-carbon-black border border-accent-gray rounded-lg py-2 pl-8 pr-4 text-pure-white font-bold focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                                    placeholder="25.00"
                                    required
                                />
                            </div>
                            
                            <div className="flex flex-col gap-3">
                                <button
                                    type="submit"
                                    disabled={isSavingDues}
                                    className="w-full bg-green-600 hover:bg-green-500 text-pure-white font-black py-3 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-green-600/20 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                                >
                                    {isSavingDues ? 'Saving...' : <><SaveIcon className="w-4 h-4" /> Save Amount</>}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowDuesModal(false)}
                                    disabled={isSavingDues}
                                    className="w-full bg-transparent hover:bg-pure-white/5 text-highlight-silver font-bold py-3 px-6 rounded-lg transition-colors border border-transparent hover:border-pure-white/10 text-xs uppercase"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Custom Confirmation Modal for Sync */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon-black/90 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-accent-gray border border-primary-red/50 rounded-xl p-8 max-w-sm w-full text-center shadow-[0_0_50px_rgba(218,41,28,0.2)] ring-1 ring-pure-white/10 animate-peek-up">
                        <div className="w-16 h-16 bg-primary-red/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AdminIcon className="w-8 h-8 text-primary-red" />
                        </div>
                        
                        <h2 className="text-2xl font-bold text-pure-white mb-2">Race Control</h2>
                        <p className="text-highlight-silver mb-8 text-sm leading-relaxed">
                            Are you sure you want to trigger a <span className="text-pure-white font-bold">Manual Clean Sweep</span>? 
                            This will force-recalculate points for ALL users across ALL races.
                        </p>
                        
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={executeSync}
                                className="w-full bg-primary-red hover:bg-red-600 text-pure-white font-black py-3 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-primary-red/20 uppercase tracking-widest text-xs"
                            >
                                Initiate Recalculation
                            </button>
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="w-full bg-transparent hover:bg-pure-white/5 text-highlight-silver font-bold py-3 px-6 rounded-lg transition-colors border border-transparent hover:border-pure-white/10 text-xs uppercase"
                            >
                                Abort
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

interface AdminTileProps {
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    title: string;
    subtitle: string;
    description: string;
    onClick: () => void;
    delay?: string;
}

const AdminTile: React.FC<AdminTileProps> = ({ icon: Icon, title, subtitle, description, onClick, delay = '0ms' }) => {
  return (
    <button
        onClick={onClick}
        className="group relative overflow-hidden rounded-xl p-6 text-left border border-pure-white/10 hover:border-primary-red/50 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col w-full min-h-[220px] bg-carbon-fiber animate-fade-in-up"
        style={{ animationDelay: delay }}
    >
        {/* Background Icon (Huge & Faded) */}
        <div className="absolute -bottom-6 -right-6 p-0 opacity-[0.03] transition-all transform duration-500 pointer-events-none group-hover:scale-110 group-hover:rotate-12 group-hover:opacity-10 text-pure-white">
            <Icon className="w-48 h-48" />
        </div>
        
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4 relative z-10">
             <div className="w-12 h-12 rounded-lg flex items-center justify-center transition-colors shadow-lg border bg-carbon-black/50 text-primary-red border-pure-white/5 group-hover:bg-primary-red/20">
                <Icon className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-bold text-highlight-silver uppercase tracking-wider bg-carbon-black/30 px-2 py-1 rounded border border-pure-white/5">{subtitle}</p>
        </div>
        
        {/* Content Section */}
        <div className="relative z-10 flex-grow flex flex-col justify-center">
            <h3 className="text-2xl font-bold mb-2 transition-colors leading-none text-pure-white group-hover:text-primary-red">{title}</h3>
            <p className="text-highlight-silver/70 text-sm leading-snug">{description}</p>
        </div>

        {/* Footer Action */}
        <div className="mt-4 pt-4 border-t border-pure-white/5 flex items-center justify-between text-xs font-bold text-pure-white opacity-60 group-hover:opacity-100 transition-opacity relative z-10">
            <span>Manage</span>
            <span className="text-primary-red transform group-hover:translate-x-1 transition-transform">&rarr;</span>
        </div>
    </button>
  );
};

export default AdminPage;
