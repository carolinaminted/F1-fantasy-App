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
        if (!searchTerm.trim()) {
            return allUsers; // Already sorted by fetch (displayName)
        }
        const lowercasedTerm = searchTerm.toLowerCase();
        return allUsers.filter(user =>
            user.displayName.toLowerCase().includes(lowercasedTerm) ||
            user.email.toLowerCase().includes(lowercasedTerm)
        );
    }, [searchTerm, allUsers]);

    const handleUserUpdate = (updatedUser: User) => {
        setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        setSelectedUser(updatedUser);
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
                        allDrivers={allDrivers}
                        allConstructors={allConstructors}
                        events={events}
                    />
                </div>
            ) : (
                /* Updated: Added md:px-1 and removed overflow-hidden to prevent focus ring clipping */
                <div className="flex-1 flex flex-col px-4 md:px-1">
                    {/* Updated: Added px-0.5 to provide gutter for the outer ring on desktop */}
                    <div className="mb-6 flex-shrink-0 px-0.5">
                        <input
                            type="text"
                            placeholder="Search among loaded users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-carbon-black/70 border border-accent-gray rounded-xl shadow-sm py-3 px-4 text-pure-white focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent appearance-none transition-all"
                        />
                    </div>

                    {isLoading ? (
                        <ListSkeleton />
                    ) : (
                        <div className="flex-1 overflow-y-auto custom-scrollbar pb-8">
                            {/* Mobile View */}
                            <div className="md:hidden">
                                {filteredUsers.map(user => <UserCard key={user.id} user={user} onClick={() => setSelectedUser(user)} />)}
                            </div>

                            {/* Desktop View */}
                            <div className="hidden md:block bg-carbon-fiber rounded-xl border border-pure-white/10 shadow-2xl overflow-hidden mb-6">
                                <table className="w-full text-left">
                                    <thead className="bg-carbon-black/80 border-b border-pure-white/10 backdrop-blur-md sticky top-0 z-10">
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
                                    </tbody>
                                </table>
                            </div>

                            {filteredUsers.length === 0 && (
                                <p className="text-center text-highlight-silver py-8 italic">No matching users found.</p>
                            )}

                            {/* Pagination Button [S1C-01] */}
                            {hasMore && (
                                <div className="flex justify-center mt-6">
                                    <button 
                                        onClick={() => fetchUsers(true)}
                                        disabled={isPaging}
                                        className="bg-accent-gray hover:bg-pure-white/10 text-pure-white font-bold py-3 px-8 rounded-lg border border-pure-white/10 transition-all flex items-center gap-3 disabled:opacity-50"
                                    >
                                        {isPaging ? (
                                            <><svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 
                                            Loading More...</>
                                        ) : 'Load More Users'}
                                    </button>
                                </div>
                            )}

                            {!hasMore && allUsers.length > 0 && (
                                <div className="text-center py-8 opacity-30 select-none">
                                    <div className="h-px bg-pure-white/10 w-32 mx-auto mb-4"></div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-highlight-silver">End of Roster</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const UserCard: React.FC<{ user: User, onClick: () => void }> = ({ user, onClick }) => (
    <div 
        onClick={onClick}
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

export default ManageUsersPage;