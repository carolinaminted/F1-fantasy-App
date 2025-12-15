
import React from 'react';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { TeamIcon } from './icons/TeamIcon.tsx';
import { TrackIcon } from './icons/TrackIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { TicketIcon } from './icons/TicketIcon.tsx';

interface AdminPageProps {
    setAdminSubPage: (page: 'dashboard' | 'results' | 'manage-users' | 'scoring' | 'entities' | 'simulation' | 'schedule' | 'invitations') => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ setAdminSubPage }) => {
    return (
        <div className="max-w-5xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold text-pure-white mb-8 text-center flex items-center justify-center gap-3">
                <AdminIcon className="w-8 h-8"/> Admin Dashboard
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                 <AdminTile
                    icon={TeamIcon}
                    title="Manage Drivers & Teams"
                    description="Update the active grid, transfers, and classes."
                    onClick={() => setAdminSubPage('entities')}
                />
                <AdminTile
                    icon={CalendarIcon}
                    title="Schedule Manager"
                    description="Set race dates, start times, and session details."
                    onClick={() => setAdminSubPage('schedule')}
                />
                <AdminTile
                    icon={TrackIcon}
                    title="Results & Locks Manager"
                    description="Enter race results and lock/unlock pick forms."
                    onClick={() => setAdminSubPage('results')}
                />
                <AdminTile
                    icon={ProfileIcon}
                    title="Manage Users"
                    description="Search users, manage dues, and view profiles."
                    onClick={() => setAdminSubPage('manage-users')}
                />
                <AdminTile
                    icon={TrophyIcon}
                    title="Scoring Settings"
                    description="Configure points awarded for race results."
                    onClick={() => setAdminSubPage('scoring')}
                />
                <AdminTile
                    icon={TicketIcon}
                    title="Invitation Codes"
                    description="Create and manage registration codes."
                    onClick={() => setAdminSubPage('invitations')}
                />
            </div>
        </div>
    );
};

interface AdminTileProps {
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    title: string;
    description: string;
    onClick: () => void;
}

const AdminTile: React.FC<AdminTileProps> = ({ icon: Icon, title, description, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="bg-carbon-fiber rounded-lg p-6 text-left border border-pure-white/10 hover:border-primary-red/50 transition-all duration-300 transform hover:-translate-y-1 shadow-lg"
    >
      <Icon className="w-10 h-10 text-primary-red mb-4" />
      <h3 className="text-xl font-bold text-pure-white mb-2">{title}</h3>
      <p className="text-highlight-silver">{description}</p>
    </button>
  );
};

export default AdminPage;
