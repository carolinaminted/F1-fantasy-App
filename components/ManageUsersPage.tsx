
import React, { useState, useEffect, useMemo } from 'react';
import { User, RaceResults, PointsSystem, Driver, Constructor, Event } from '../types.ts';
import { getAllUsers, getTotalUserCount, DEFAULT_PAGE_SIZE } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import {
    PageHeader, DataTable, SegmentedControl, Chip, NUMERIC,
    type Column, type Segment,
} from './ui/index.ts';
import { AdminToolShell } from './admin/index.ts';
import AdminUserProfileView from './AdminUserProfileView.tsx';
import { ListSkeleton } from './LoadingSkeleton.tsx';
import type { AdminDestination } from '../routes.ts';

interface ManageUsersPageProps {
    setAdminSubPage: (page: AdminDestination) => void;
    raceResults: RaceResults;
    pointsSystem: PointsSystem;
    allDrivers: Driver[];
    allConstructors: Constructor[];
    events: Event[];
    cancelledEventIds: Set<string>;
}

type MemberFilter = 'all' | 'unpaid' | 'admin';

const FILTERS: Segment<MemberFilter>[] = [
    { value: 'all', label: 'Everyone' },
    { value: 'unpaid', label: 'Not paid' },
    { value: 'admin', label: 'Admins' },
];

const ManageUsersPage: React.FC<ManageUsersPageProps> = ({ setAdminSubPage, raceResults, pointsSystem, allDrivers, allConstructors, events, cancelledEventIds }) => {
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [totalUserCount, setTotalUserCount] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isPaging, setIsPaging] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [lastVisible, setLastVisible] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [filterType, setFilterType] = useState<MemberFilter>('all');
    const [sortField, setSortField] = useState<'displayName' | 'email' | 'createdAt' | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const fetchUsers = async (isMore = false) => {
        if (isMore) setIsPaging(true);
        else setIsLoading(true);

        try {
            const [{ users, lastDoc }, count] = await Promise.all([
                getAllUsers(DEFAULT_PAGE_SIZE, isMore ? lastVisible : null),
                !isMore ? getTotalUserCount() : Promise.resolve(totalUserCount)
            ]);
            
            if (isMore) {
                setAllUsers(prev => [...prev, ...users]);
            } else {
                setAllUsers(users);
                setTotalUserCount(count);
            }

            setLastVisible(lastDoc);
            setHasMore(users.length === DEFAULT_PAGE_SIZE);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setIsLoading(false);
            setIsPaging(false);
        }
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

    const handleSort = (field: 'displayName' | 'email' | 'createdAt') => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const sortedUsers = useMemo(() => {
        if (!sortField) return filteredUsers;

        return [...filteredUsers].sort((a, b) => {
            let valA = sortField === 'createdAt' ? (a as any).createdAt : a[sortField];
            let valB = sortField === 'createdAt' ? (b as any).createdAt : b[sortField];

            // Handle Firestore Timestamp
            if (valA && typeof valA === 'object' && 'seconds' in valA) {
                valA = valA.seconds;
            }
            if (valB && typeof valB === 'object' && 'seconds' in valB) {
                valB = valB.seconds;
            }

            if (valA === valB) return 0;
            // Push nulls to bottom
            if (!valA) return 1;
            if (!valB) return -1;

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredUsers, sortField, sortDirection]);

    const handleUserUpdate = (updatedUser: User) => {
        setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        setSelectedUser(updatedUser);
    };

    const handleUserDeleted = (userId: string) => {
        setAllUsers(prev => prev.filter(u => u.id !== userId));
        setSelectedUser(null);
    };

    /* Sortable header: the old table hand-rolled these with ▲/▼ glyphs. */
    const sortHeader = (label: string, field: 'displayName' | 'email' | 'createdAt') => (
        <button
            onClick={() => handleSort(field)}
            className="flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-pure-white"
        >
            {label}
            <span className={sortField === field ? 'text-primary-red' : 'opacity-0'}>
                {sortDirection === 'asc' ? '\u25B2' : '\u25BC'}
            </span>
        </button>
    );

    const columns: Column<User>[] = [
        {
            key: 'name',
            header: sortHeader('Member', 'displayName'),
            render: user => (
                <div className="min-w-0">
                    <span className="block truncate font-bold text-pure-white">{user.displayName}</span>
                    <span className="block truncate text-xs text-highlight-silver">
                        {`${user.firstName || ''} ${user.lastName || ''}`.trim() || '\u2014'}
                    </span>
                    {/* The phone has no room for a column each, so the detail rides along here. */}
                    <span className={`mt-0.5 block truncate text-[11px] text-highlight-silver md:hidden ${NUMERIC}`}>
                        {user.email}
                    </span>
                </div>
            ),
        },
        {
            key: 'email',
            header: sortHeader('Email', 'email'),
            hideOnMobile: true,
            render: user => <span className={`text-highlight-silver ${NUMERIC}`}>{user.email}</span>,
        },
        {
            key: 'joined',
            header: sortHeader('Joined', 'createdAt'),
            hideOnMobile: true,
            numeric: true,
            render: user => {
                const created = (user as any).createdAt?.seconds;
                return created ? new Date(created * 1000).toLocaleDateString() : '\u2014';
            },
        },
        {
            key: 'dues',
            header: 'Dues',
            align: 'center',
            render: user => (
                <Chip
                    label={(user.duesPaidStatus || 'Unpaid') === 'Paid' ? 'Paid' : 'Not paid'}
                    tone={(user.duesPaidStatus || 'Unpaid') === 'Paid' ? 'success' : 'danger'}
                    size="xs"
                />
            ),
        },
        {
            key: 'role',
            header: 'Role',
            align: 'center',
            hideOnMobile: true,
            render: user =>
                user.isAdmin
                    ? <Chip label="Admin" tone="danger" size="xs" />
                    : <span className="text-[11px] uppercase tracking-wider text-highlight-silver">Member</span>,
        },
    ];

    /* An admin viewing one member is a step deeper, so the back link changes with it. */
    if (selectedUser) {
        return (
            <div className="max-w-7xl mx-auto text-pure-white h-full flex flex-col">
                <PageHeader
                    title={selectedUser.displayName?.toUpperCase() || 'MEMBER'}
                    icon={ProfileIcon}
                    subtitle="Viewing this member as an admin"
                    leftAction={
                        <button
                            onClick={() => setSelectedUser(null)}
                            className="flex items-center gap-2 rounded-lg border border-pure-white/10 bg-carbon-black/50 px-4 py-2 text-highlight-silver transition-colors hover:border-pure-white/30 hover:text-pure-white"
                        >
                            <BackIcon className="w-4 h-4" />
                            <span className="text-sm font-bold">All members</span>
                        </button>
                    }
                />
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
                        cancelledEventIds={cancelledEventIds}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto text-pure-white h-full flex flex-col">
            <AdminToolShell
                title="MEMBERS"
                icon={ProfileIcon}
                subtitle="Find a member to mark dues paid, edit their picks, or manage their account"
                setAdminSubPage={setAdminSubPage}
            />

            <div className="flex min-h-0 flex-1 flex-col px-4 md:px-1 pb-8 md:overflow-hidden">
                <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Search by name or email\u2026"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full rounded-xl border border-pure-white/10 bg-carbon-black px-3.5 py-2.5 text-sm text-pure-white placeholder-highlight-silver/50 transition-colors focus:border-primary-red focus:outline-none"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold uppercase tracking-wider text-highlight-silver hover:text-pure-white"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <SegmentedControl
                        segments={FILTERS}
                        value={filterType}
                        onChange={v => setFilterType(v)}
                        size="sm"
                        scrollable
                    />
                </div>

                <div className={`mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-highlight-silver ${NUMERIC}`}>
                    <span>
                        Showing {sortedUsers.length}
                        {totalUserCount !== null && ` of ${totalUserCount} members`}
                    </span>
                    <span className="hidden sm:inline normal-case tracking-normal">
                        Choose a member to open their account
                    </span>
                </div>

                {isLoading ? (
                    <ListSkeleton />
                ) : (
                    <>
                        <DataTable
                            columns={columns}
                            rows={sortedUsers}
                            rowKey={user => user.id}
                            onRowClick={user => setSelectedUser(user)}
                            scrollInside
                            emptyTitle="No members match"
                            emptyDescription="Try a different name, email, or filter."
                        />

                        {hasMore && (
                            <div className="flex shrink-0 justify-center pt-4">
                                <button
                                    onClick={() => fetchUsers(true)}
                                    disabled={isPaging}
                                    className="rounded-lg border border-pure-white/10 bg-accent-gray px-6 py-2 text-xs font-bold uppercase tracking-wider text-pure-white transition-colors hover:bg-pure-white/10 disabled:opacity-50"
                                >
                                    {isPaging ? 'Loading\u2026' : 'Show more members'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ManageUsersPage;
