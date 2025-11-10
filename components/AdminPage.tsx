import React from 'react';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { LeaderboardIcon } from './icons/LeaderboardIcon.tsx';
import { LockIcon } from './icons/LockIcon.tsx';

interface AdminPageProps {
    setAdminSubPage: (page: 'results' | 'form-lock') => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ setAdminSubPage }) => {
    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold text-pure-white mb-8 text-center flex items-center justify-center gap-3">
                <AdminIcon className="w-8 h-8"/> Admin Dashboard
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AdminTile
                    icon={LeaderboardIcon}
                    title="Results Entry"
                    description="Update and manage race results for each event."
                    onClick={() => setAdminSubPage('results')}
                />
                <AdminTile
                    icon={LockIcon}
                    title="Form Lock"
                    description="Manually lock or unlock pick submission forms."
                    onClick={() => setAdminSubPage('form-lock')}
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
      className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 text-left ring-1 ring-pure-white/10 hover:ring-primary-red transition-all duration-300 transform hover:-translate-y-1"
    >
      <Icon className="w-10 h-10 text-primary-red mb-4" />
      <h3 className="text-xl font-bold text-pure-white mb-2">{title}</h3>
      <p className="text-highlight-silver">{description}</p>
    </button>
  );
};

export default AdminPage;