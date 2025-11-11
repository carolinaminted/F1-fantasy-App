import React, { useState, useEffect, useMemo } from 'react';
import { User, RaceResults } from '../types.ts';
import { getAllUsers } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import AdminUserProfileView from './AdminUserProfileView.tsx';

interface ManageUsersPageProps {
    setAdminSubPage: (page: 'dashboard') => void;
    raceResults: RaceResults;
}

const ManageUsersPage: React.FC<ManageUsersPageProps> = ({ setAdminSubPage, raceResults }) => {
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            setIsLoading(true);
            const users = await getAllUsers();
            setAllUsers(users.filter(u => u.email !== 'admin@fantasy.f1')); // Exclude admin
            setIsLoading(false);
        };
        fetchUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        if (!searchTerm.trim()) {
            return allUsers.sort((a, b) => a.displayName.localeCompare(b.displayName));
        }
        const lowercasedTerm = searchTerm.toLowerCase();
        return allUsers.filter(user =>
            user.displayName.toLowerCase().includes(lowercasedTerm) ||
            user.email.toLowerCase().includes(lowercasedTerm)
        ).sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [searchTerm, allUsers]);

    if (selectedUser) {
        return (
            <div className="max-w-7xl mx-auto">
                 <div className="mb-4">
                    <button 
                        onClick={() => setSelectedUser(null)} 
                        className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors"
                    >
                        <BackIcon className="w-5 h-5" />
                        Back to User List
                    </button>
                </div>
                <AdminUserProfileView targetUser={selectedUser} raceResults={raceResults} />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto text-pure-white">
            <div className="flex items-center justify-between mb-8">
                <button 
                    onClick={() => setAdminSubPage('dashboard')}
                    className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors"
                >
                    <BackIcon className="w-5 h-5" />
                    Back
                </button>
                <h1 className="text-3xl font-bold flex items-center gap-3 text-right">
                    Manage Users <ProfileIcon className="w-8 h-8"/>
                </h1>
            </div>

            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-carbon-black/70 border border-accent-gray rounded-md shadow-sm py-3 px-4 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red"
                />
            </div>

            {isLoading ? (
                <p className="text-center text-highlight-silver">Loading users...</p>
            ) : (
                <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-carbon-black/50">
                            <tr>
                                <th className="p-4 text-sm font-semibold uppercase text-highlight-silver">Name</th>
                                <th className="p-4 text-sm font-semibold uppercase text-highlight-silver hidden md:table-cell">Email</th>
                                <th className="p-4 text-sm font-semibold uppercase text-highlight-silver text-center">Dues Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => (
                                <tr 
                                    key={user.id} 
                                    className="border-t border-accent-gray/50 hover:bg-accent-gray/70 cursor-pointer"
                                    onClick={() => setSelectedUser(user)}
                                >
                                    <td className="p-4 font-semibold">{user.displayName}</td>
                                    <td className="p-4 text-highlight-silver hidden md:table-cell">{user.email.replace(/^(.).+(@.+)$/, '$1****$2')}</td>
                                    <td className="p-4 text-center">
                                         <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full ${
                                            (user.duesPaidStatus || 'Unpaid') === 'Paid'
                                            ? 'bg-green-600/80 text-pure-white'
                                            : 'bg-primary-red/80 text-pure-white'
                                        }`}>
                                            {user.duesPaidStatus || 'Unpaid'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="text-center p-8 text-highlight-silver">
                                        No users found for "{searchTerm}".
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ManageUsersPage;