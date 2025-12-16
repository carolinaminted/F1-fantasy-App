
import React, { useState, useEffect, useMemo } from 'react';
import { User, RaceResults, PointsSystem, Driver, Constructor, Event } from '../types.ts';
import { getAllUsers } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import AdminUserProfileView from './AdminUserProfileView.tsx';
import { ListSkeleton } from './LoadingSkeleton.tsx';

interface ManageUsersPageProps {
    setAdminSubPage: (page: 'dashboard') => void;
    raceResults: RaceResults;
    pointsSystem: PointsSystem;
    allDrivers: Driver[];
    allConstructors: Constructor[];
    events: Event[];
}

const ManageUsersPage: React.FC<ManageUsersPageProps> = ({ setAdminSubPage, raceResults, pointsSystem, allDrivers, allConstructors, events }) => {
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            setIsLoading(true);
            const users = await getAllUsers();
            setAllUsers(users); 
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

    const handleUserUpdate = (updatedUser: User) => {
        setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        setSelectedUser(updatedUser);
    };

    if (selectedUser) {
        return (
            <div className="max-w-7xl mx-auto">
                 <div className="mb-4">
                    <button 
                        onClick={() => setSelectedUser(null)} 
                        className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors py-2"
                    >
                        <BackIcon className="w-5 h-5" />
                        Back to User List
                    </button>
                </div>
                <AdminUserProfileView 
                    targetUser={selectedUser} 
                    raceResults={raceResults} 
                    pointsSystem={pointsSystem} 
                    onUpdateUser={handleUserUpdate}
                    allDrivers={allDrivers}
                    allConstructors={allConstructors}
                    events={events}
                />
            </div>
        );
    }

    // Sub-component for Mobile Card
    const UserCard: React.FC<{ user: User }> = ({ user }) => (
        <div 
            onClick={() => setSelectedUser(user)}
            className="bg-carbon-fiber rounded-xl p-4 mb-3 border border-pure-white/10 shadow-lg active:scale-[0.99] transition-all"
        >
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="font-bold text-pure-white text-lg">{user.displayName}</h3>
                    <p className="text-highlight-silver text-sm">{user.email.replace(/^(.).+(@.+)$/, '$1****$2')}</p>
                </div>
                {user.isAdmin && <span className="bg-primary-red text-pure-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shadow-sm shadow-primary-red/50">Admin</span>}
            </div>
            <div className="flex justify-between items-center mt-3 border-t border-pure-white/5 pt-3">
                 <span className="text-xs text-highlight-silver uppercase tracking-wider">Status</span>
                 <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full border ${
                    (user.duesPaidStatus || 'Unpaid') === 'Paid'
                    ? 'bg-green-600/20 text-green-400 border-green-500/30'
                    : 'bg-red-900/20 text-red-400 border-red-500/30'
                }`}>
                    {user.duesPaidStatus || 'Unpaid'}
                </span>
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto text-pure-white">
            <div className="flex items-center justify-between mb-6 md:mb-8">
                <button 
                    onClick={() => setAdminSubPage('dashboard')}
                    className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors"
                >
                    <BackIcon className="w-5 h-5" />
                    Back
                </button>
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-right">
                    Manage Users <ProfileIcon className="w-8 h-8"/>
                </h1>
            </div>

            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-carbon-black/70 border border-accent-gray rounded-xl shadow-sm py-3 px-4 text-pure-white focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent appearance-none transition-all"
                />
            </div>

            {isLoading ? (
                <ListSkeleton />
            ) : (
                <>
                    {/* Mobile View */}
                    <div className="md:hidden">
                        {filteredUsers.map(user => <UserCard key={user.id} user={user} />)}
                        {filteredUsers.length === 0 && <p className="text-center text-highlight-silver py-8">No users found.</p>}
                    </div>

                    {/* Desktop View */}
                    <div className="hidden md:block bg-carbon-fiber rounded-xl border border-pure-white/10 shadow-2xl overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-carbon-black/80 border-b border-pure-white/10 backdrop-blur-md">
                                <tr>
                                    <th className="p-4 text-sm font-bold uppercase text-highlight-silver tracking-wider">Name</th>
                                    <th className="p-4 text-sm font-bold uppercase text-highlight-silver tracking-wider hidden md:table-cell">Email</th>
                                    <th className="p-4 text-sm font-bold uppercase text-highlight-silver tracking-wider text-center">Dues Status</th>
                                    <th className="p-4 text-sm font-bold uppercase text-highlight-silver tracking-wider text-center">Role</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-pure-white/5">
                                {filteredUsers.map(user => (
                                    <tr 
                                        key={user.id} 
                                        className="hover:bg-pure-white/5 transition-colors cursor-pointer group"
                                        onClick={() => setSelectedUser(user)}
                                    >
                                        <td className="p-4">
                                            <span className="font-bold text-pure-white group-hover:text-primary-red transition-colors">{user.displayName}</span>
                                        </td>
                                        <td className="p-4 text-highlight-silver hidden md:table-cell font-mono text-sm">{user.email.replace(/^(.).+(@.+)$/, '$1****$2')}</td>
                                        <td className="p-4 text-center">
                                             <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full border ${
                                                (user.duesPaidStatus || 'Unpaid') === 'Paid'
                                                ? 'bg-green-600/20 text-green-400 border-green-500/30'
                                                : 'bg-red-900/20 text-red-400 border-red-500/30'
                                            }`}>
                                                {user.duesPaidStatus || 'Unpaid'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            {user.isAdmin ? (
                                                <span className="px-3 py-1 text-xs font-bold uppercase rounded-full bg-primary-red text-pure-white shadow-sm shadow-primary-red/50">Admin</span>
                                            ) : (
                                                <span className="text-highlight-silver text-xs font-medium">User</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center p-8 text-highlight-silver italic">
                                            No users found for "{searchTerm}".
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};

export default ManageUsersPage;
