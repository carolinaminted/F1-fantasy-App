
import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../types.ts';
import { getAllUsers, updateUserDuesStatus } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';

interface DuesStatusManagerPageProps {
    setAdminSubPage: (page: 'dashboard') => void;
}

const DuesStatusManagerPage: React.FC<DuesStatusManagerPageProps> = ({ setAdminSubPage }) => {
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            setIsLoading(true);
            const users = await getAllUsers();
            setAllUsers(users); // Include all users
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

    const handleUpdateStatus = async (status: 'Paid' | 'Unpaid') => {
        if (!selectedUser) return;
        setIsUpdating(true);
        try {
            await updateUserDuesStatus(selectedUser.id, status);
            // Update local state for immediate feedback
            setAllUsers(prevUsers => prevUsers.map(u => u.id === selectedUser.id ? { ...u, duesPaidStatus: status } : u));
            setSelectedUser(null);
        } catch (error) {
            console.error("Failed to update status", error);
            alert("An error occurred. Please try again.");
        } finally {
            setIsUpdating(false);
        }
    };

    const UserModal: React.FC = () => {
        if (!selectedUser) return null;
        return (
            <div className="fixed inset-0 bg-carbon-black/80 flex items-center justify-center z-50 p-4" onClick={() => !isUpdating && setSelectedUser(null)}>
                <div className="bg-accent-gray rounded-lg max-w-md w-full ring-1 ring-pure-white/20 shadow-2xl" onClick={e => e.stopPropagation()}>
                    <div className="p-6">
                        <h3 className="text-2xl font-bold text-pure-white mb-2">{selectedUser.displayName}</h3>
                        <p className="text-highlight-silver mb-4">{selectedUser.email}</p>
                        <p className="mb-4">Current Status: 
                            <span className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-full ${
                                (selectedUser.duesPaidStatus || 'Unpaid') === 'Paid'
                                ? 'bg-green-600/80 text-pure-white'
                                : 'bg-primary-red/80 text-pure-white'
                            }`}>
                                {selectedUser.duesPaidStatus || 'Unpaid'}
                            </span>
                        </p>
                        <div className="flex justify-end gap-4 mt-6">
                            <button
                                onClick={() => handleUpdateStatus('Unpaid')}
                                disabled={isUpdating}
                                className="bg-primary-red/80 hover:bg-primary-red text-pure-white font-bold py-2 px-4 rounded-lg disabled:opacity-50"
                            >
                                Set as Unpaid
                            </button>
                             <button
                                onClick={() => handleUpdateStatus('Paid')}
                                disabled={isUpdating}
                                className="bg-green-600 hover:bg-green-500 text-pure-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 w-32"
                            >
                                {isUpdating ? 'Saving...' : 'Set as Paid'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };
    
    // Mobile Card Component
    const UserCard: React.FC<{ user: User }> = ({ user }) => (
        <div 
            onClick={() => setSelectedUser(user)}
            className="bg-accent-gray/50 rounded-lg p-4 mb-3 border border-pure-white/5 active:bg-pure-white/10"
        >
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-pure-white text-lg">{user.displayName}</h3>
                <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full ${
                    (user.duesPaidStatus || 'Unpaid') === 'Paid'
                    ? 'bg-green-600/80 text-pure-white'
                    : 'bg-primary-red/80 text-pure-white'
                }`}>
                    {user.duesPaidStatus || 'Unpaid'}
                </span>
            </div>
            <p className="text-highlight-silver text-sm">{user.email}</p>
        </div>
    );

    return (
        <>
        <div className="max-w-7xl mx-auto text-pure-white">
            <div className="flex items-center justify-between mb-8">
                <button 
                    onClick={() => setAdminSubPage('dashboard')}
                    className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors"
                >
                    <BackIcon className="w-5 h-5" />
                    Back
                </button>
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-right">
                    Dues Status <ProfileIcon className="w-8 h-8"/>
                </h1>
            </div>

            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-carbon-black/70 border border-accent-gray rounded-md shadow-sm py-3 px-4 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red appearance-none"
                />
            </div>

            {isLoading ? (
                <p className="text-center text-highlight-silver">Loading users...</p>
            ) : (
                <>
                    {/* Mobile View */}
                    <div className="md:hidden">
                        {filteredUsers.map(user => <UserCard key={user.id} user={user} />)}
                        {filteredUsers.length === 0 && <p className="text-center text-highlight-silver py-8">No users found.</p>}
                    </div>

                    {/* Desktop View */}
                    <div className="hidden md:block bg-accent-gray/50 backdrop-blur-sm rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
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
                                        <td className="p-4 text-highlight-silver hidden md:table-cell">{user.email}</td>
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
                                            No users found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
        <UserModal />
        </>
    );
};

export default DuesStatusManagerPage;
