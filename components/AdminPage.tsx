
import React from 'react';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { TeamIcon } from './icons/TeamIcon.tsx';
import { TrackIcon } from './icons/TrackIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { TicketIcon } from './icons/TicketIcon.tsx';
import { PageHeader } from './ui/PageHeader.tsx';

interface AdminPageProps {
    setAdminSubPage: (page: 'dashboard' | 'results' | 'manage-users' | 'scoring' | 'entities' | 'simulation' | 'schedule' | 'invitations') => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ setAdminSubPage }) => {
    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-none">
                <PageHeader 
                    title="ADMIN DASHBOARD" 
                    icon={AdminIcon} 
                    subtitle="League Controls & Configuration"
                />
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 p-6">
                <div className="max-w-[1600px] mx-auto w-full">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                         <AdminTile
                            icon={TeamIcon}
                            title="Manage Drivers & Teams"
                            subtitle="Entities"
                            description="Update the active grid, transfers, and classes."
                            onClick={() => setAdminSubPage('entities')}
                            delay="0ms"
                        />
                        <AdminTile
                            icon={CalendarIcon}
                            title="Schedule Manager"
                            subtitle="Calendar"
                            description="Set race dates, start times, and session details."
                            onClick={() => setAdminSubPage('schedule')}
                            delay="100ms"
                        />
                        <AdminTile
                            icon={TrackIcon}
                            title="Results & Locks Manager"
                            subtitle="Race Control"
                            description="Enter race results and lock/unlock pick forms."
                            onClick={() => setAdminSubPage('results')}
                            delay="200ms"
                        />
                        <AdminTile
                            icon={ProfileIcon}
                            title="Manage Users"
                            subtitle="Membership"
                            description="Search users, manage dues, and view profiles."
                            onClick={() => setAdminSubPage('manage-users')}
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
            </div>
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
        className="group relative overflow-hidden rounded-xl p-5 text-left border border-pure-white/10 hover:border-primary-red/50 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col h-full w-full bg-carbon-fiber animate-fade-in-up"
        style={{ animationDelay: delay }}
    >
        {/* Background Icon (Huge & Faded) */}
        <div className="absolute -bottom-6 -right-6 p-0 opacity-[0.03] transition-all transform duration-500 pointer-events-none group-hover:scale-110 group-hover:rotate-12 group-hover:opacity-10 text-pure-white">
            <Icon className="w-48 h-48" />
        </div>
        
        {/* Header Section */}
        <div className="flex items-start justify-between mb-3 relative z-10">
             <div className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors shadow-lg border bg-carbon-black/50 text-primary-red border-pure-white/5 group-hover:bg-primary-red/20">
                <Icon className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-bold text-highlight-silver uppercase tracking-wider bg-carbon-black/30 px-2 py-1 rounded border border-pure-white/5">{subtitle}</p>
        </div>
        
        {/* Content Section */}
        <div className="relative z-10 flex-grow flex flex-col justify-center">
            <h3 className="text-2xl font-bold mb-2 transition-colors leading-none text-pure-white group-hover:text-primary-red">{title}</h3>
            <p className="text-highlight-silver/70 text-sm leading-snug">{description}</p>
        </div>
        
        {/* Footer Action removed as per user request to remove 'Access' text and the 'little red line' (arrow) */}
    </button>
  );
};

export default AdminPage;
