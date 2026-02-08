
import React, { useState, useEffect, useMemo } from 'react';
import { User, RaceResults, PointsSystem, Driver, Constructor, Event } from '../types.ts';
import { getAllUsers, DEFAULT_PAGE_SIZE } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
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
    const [isPaging, setIsPaging] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [lastVisible, setLastVisible] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [filterType, setFilterType] = useState<'all' | 'unpaid' | 'admin'>('all');

    const fetchUsers = async (isMore = false) => {
        if (isMore) setIsPaging(true);
        else setIsLoading(true);

        const { users, lastDoc } = await getAllUsers(DEFAULT_PAGE_SIZE, isMore ? lastVisible : null);
        
        if (isMore) {
            setAllUsers(prev => [...prev, ...users]);
        } else {
            setAllUsers(users);
        }

        setLastVisible(lastDoc);
        setHasMore(users.length === DEFAULT_PAGE_SIZE);
        
        setIsLoading(false);
        setIsPaging(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        let result = allUsers;

        // 1. Filter by Type
        if (filterType === 'unpaid') {
            result = result.filter(u => (u.duesPaidStatus || 'Unpaid') === 'Unpaid');
        } else if (filterType === 'admin') {
            result = result.filter(u => !!u.isAdmin);
        }

        // 2. Filter by Search
        if (!searchTerm.trim()) {
            return result; 
        }
        const lowercasedTerm = searchTerm.toLowerCase();
        return result.filter(user =>
            (user.displayName || '').toLowerCase().includes(lowercasedTerm) ||
            (user.email || '').toLowerCase().includes(lowercasedTerm)
        );
    }, [searchTerm, allUsers, filterType]);

    const handleUserUpdate = (updatedUser: User) => {
        setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        setSelectedUser(updatedUser);
    };

    const handleUserDeleted = (userId: string) => {
        setAllUsers(prev => prev.filter(u => u.id !== userId));
        setSelectedUser(null);
    };

    const DashboardAction = (
        <button 
            onClick={() => selectedUser ? setSelectedUser(null) : setAdminSubPage('dashboard')}
            className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10 hover:border-pure-white/30"
        >
            <BackIcon className="w-4 h-4" /> 
            <span className="text-sm font-bold">{selectedUser ? 'Back to List' : 'Dashboard'}</span>
        </button>
    );

    return (
        <div className="max-w-7xl mx-auto text-pure-white h-full flex flex-col">
            <PageHeader 
                title={selectedUser ? "EDIT USER" : "MANAGE USERS"} 
                icon={ProfileIcon} 
                leftAction={DashboardAction}
            />

            {selectedUser ? (
                <div className="flex-1 overflow-y-auto px-4 md:px-0 pb-8 custom-scrollbar">
                    <AdminUserProfileView 
                        targetUser={selectedUser} 
                        raceResults={raceResults} 
                        pointsSystem={pointsSystem} 
                        onUpdateUser={handleUserUpdate}
                        onDeleteUser={handleUserDeleted}
                        allDrivers={allDrivers}
                        allConstructors={allConstructors}
                        events={events}
                    />
                </div>
            ) : (
                <div className="flex-1 md:overflow-hidden px-4 md:px-1 pb-8 flex flex-col">
                    <div className="bg-carbon-fiber rounded-lg border border-pure-white/10 shadow-lg md:overflow-hidden flex flex-col md:flex-1">
                        
                        {/* Card Header with Search and Toggles */}
                        <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-carbon-black/50 border-b border-pure-white/10 flex-shrink-0">
                            {/* Search Input */}
                            <div className="w-full md:w-auto flex-1 max-w-md relative">
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-carbon-black border border-accent-gray rounded-lg px-4 py-2 text-sm text-pure-white focus:outline-none focus:border-primary-red transition-colors"
                                />
                            </div>

                            {/* Filter Toggles */}
                            <div className="flex items-center gap-2 bg-carbon-black/80 rounded-lg p-1 w-full md:w-auto justify-center">
                                <button
                                    onClick={() => setFilterType('all')}
                                    className={`px-3 py-1 text-xs font-bold uppercase rounded-md transition-colors flex-1 md:flex-none text-center ${
                                        filterType === 'all' 
                                        ? 'bg-pure-white text-carbon-black shadow-sm' 
                                        : 'text-highlight-silver hover:text-pure-white'
                                    }`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setFilterType('unpaid')}
                                    className={`px-3 py-1 text-xs font-bold uppercase rounded-md transition-colors flex-1 md:flex-none text-center ${
                                        filterType === 'unpaid' 
                                        ? 'bg-primary-red text-pure-white shadow-sm' 
                                        : 'text-highlight-silver hover:text-pure-white'
                                    }`}
                                >
                                    Unpaid
                                </button>
                                <button
                                    onClick={() => setFilterType('admin')}
                                    className={`px-3 py-1 text-xs font-bold uppercase rounded-md transition-colors flex-1 md:flex-none text-center ${
                                        filterType === 'admin' 
                                        ? 'bg-primary-red text-pure-white shadow-sm' 
                                        : 'text-highlight-silver hover:text-pure-white'
                                    }`}
                                >
                                    Admins
                                </button>
                            </div>
                        </div>

                        {/* List Content */}
                        {isLoading ? (
                            <div className="p-4"><ListSkeleton /></div>
                        ) : (
                            <div className="overflow-y-auto md:flex-1 custom-scrollbar pb-32 md:pb-0">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-carbon-black/30 sticky top-0 z-10 backdrop-blur-sm">
                                        <tr>
                                            <th className="p-4 text-[10px] font-black uppercase text-highlight-silver tracking-[0.2em]">Name</th>
                                            <th className="p-4 text-[10px] font-black uppercase text-highlight-silver tracking-[0.2em] hidden md:table-cell">Email</th>
                                            <th className="p-4 text-[10px] font-black uppercase text-highlight-silver tracking-[0.2em] text-center">Status</th>
                                            <th className="p-4 text-[10px] font-black uppercase text-highlight-silver tracking-[0.2em] text-center">Role</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.map(user => (
                                            <tr 
                                                key={user.id} 
                                                className="border-t border-pure-white/5 hover:bg-pure-white/5 transition-colors cursor-pointer group"
                                                onClick={() => setSelectedUser(user)}
                                            >
                                                <td className="p-4 align-middle">
                                                    <span className="font-bold text-base md:text-lg text-pure-white group-hover:text-primary-red transition-colors block">{user.displayName}</span>
                                                    {/* Mobile email fallback */}
                                                    <span className="md:hidden text-xs text-highlight-silver font-mono opacity-70">{user.email?.replace(/^(.).+(@.+)$/, '$1****$2')}</span>
                                                </td>
                                                <td className="p-4 align-middle hidden md:table-cell">
                                                    <span className="text-sm text-highlight-silver font-mono">{user.email?.replace(/^(.).+(@.+)$/, '$1****$2')}</span>
                                                </td>
                                                <td className="p-4 text-center align-middle">
                                                     <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full border ${
                                                        (user.duesPaidStatus || 'Unpaid') === 'Paid'
                                                        ? 'bg-green-600/20 text-green-400 border-green-500/30'
                                                        : 'bg-red-900/20 text-red-400 border-red-500/30'
                                                    }`}>
                                                        {user.duesPaidStatus || 'Unpaid'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center align-middle">
                                                    {user.isAdmin ? (
                                                        <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-primary-red text-pure-white shadow-sm shadow-primary-red/50">Admin</span>
                                                    ) : (
                                                        <span className="text-highlight-silver text-[10px] font-medium uppercase tracking-wider">User</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredUsers.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-highlight-silver italic opacity-50">No users found matching criteria.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                
                                {/* Pagination Button */}
                                {hasMore && (
                                    <div className="p-4 flex justify-center border-t border-pure-white/5">
                                        <button 
                                            onClick={() => fetchUsers(true)}
                                            disabled={isPaging}
                                            className="bg-accent-gray hover:bg-pure-white/10 text-pure-white font-bold py-2 px-6 rounded-lg border border-pure-white/10 transition-all flex items-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50"
                                        >
                                            {isPaging ? 'Loading...' : 'Load More'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageUsersPage;
