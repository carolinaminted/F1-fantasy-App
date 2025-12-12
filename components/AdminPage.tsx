
import React, { useState } from 'react';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { TeamIcon } from './icons/TeamIcon.tsx';
import { TrackIcon } from './icons/TrackIcon.tsx';
import { migrateUsersToPublic } from '../services/firestoreService.ts';

interface AdminPageProps {
    setAdminSubPage: (page: 'dashboard' | 'results' | 'manage-users' | 'scoring' | 'entities') => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ setAdminSubPage }) => {
    const [isMigrating, setIsMigrating] = useState(false);

    const handleMigration = async () => {
        if (!window.confirm("This will copy displayName from 'users' to 'public_users' for the leaderboard. Run this if the leaderboard is empty.")) return;
        
        setIsMigrating(true);
        const result = await migrateUsersToPublic();
        setIsMigrating(false);
        
        if (result.success) {
            alert(`Migration Complete! Synced ${result.count} users.`);
        } else {
            alert("Migration failed. Check console.");
        }
    };

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
            </div>
            
            {/* Maintenance Section */}
            <div className="border-t border-pure-white/10 pt-6">
                <h3 className="text-highlight-silver text-sm font-bold uppercase tracking-wider mb-4">Maintenance & Security</h3>
                <button
                    onClick={handleMigration}
                    disabled={isMigrating}
                    className="bg-carbon-black border border-accent-gray text-highlight-silver hover:text-pure-white hover:border-pure-white px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                >
                    {isMigrating ? 'Migrating Data...' : 'Run PII Security Migration'}
                </button>
                <p className="text-xs text-highlight-silver mt-2 max-w-2xl">
                    Run this once to populate the new public leaderboard collection. This separates email/dues data from public scores.
                </p>
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
      className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 text-left ring-1 ring-pure-white/10 hover:ring-primary-red transition-all duration-300 transform hover:-translate-y-1"
    >
      <Icon className="w-10 h-10 text-primary-red mb-4" />
      <h3 className="text-xl font-bold text-pure-white mb-2">{title}</h3>
      <p className="text-highlight-silver">{description}</p>
    </button>
  );
};

export default AdminPage;
