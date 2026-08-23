
import React, { useState, useEffect, useMemo } from 'react';
import { User, InvitationCode } from '../types.ts';
import { getInvitationCodes, createInvitationCode, createBulkInvitationCodes, deleteInvitationCode, reserveInvitationCode, clearReservation } from '../services/firestoreService.ts';
import { TicketIcon } from './icons/TicketIcon.tsx';
import { CopyIcon } from './icons/CopyIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import {
    StatTile, DataTable, SegmentedControl, Chip, Modal, NUMERIC,
    type Column, type Segment,
} from './ui/index.ts';
import { AdminToolShell, ConfirmModal } from './admin/index.ts';
import { ListSkeleton } from './LoadingSkeleton.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import type { AdminDestination } from '../routes.ts';

interface AdminInvitationPageProps {
    setAdminSubPage: (page: AdminDestination) => void;
    user: User | null;
}

type CodeFilter = 'all' | 'available' | 'reserved' | 'used';

const FILTERS: Segment<CodeFilter>[] = [
    { value: 'all', label: 'All' },
    { value: 'available', label: 'Available' },
    { value: 'reserved', label: 'Reserved' },
    { value: 'used', label: 'Used' },
];

const AdminInvitationPage: React.FC<AdminInvitationPageProps> = ({ setAdminSubPage, user }) => {
    const [codes, setCodes] = useState<InvitationCode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<CodeFilter>('available');
    const [isCreating, setIsCreating] = useState(false);
    const [bulkAmount, setBulkAmount] = useState(1);
    
    // Selection State
    const [selectedCodeObj, setSelectedCodeObj] = useState<InvitationCode | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    
    // Reservation State
    const [isReserving, setIsReserving] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [reservationName, setReservationName] = useState('');
    const [showReserveInput, setShowReserveInput] = useState(false);

    const { showToast } = useToast();

    // Reset confirmation states when a new modal is opened
    useEffect(() => {
        if (selectedCodeObj) {
            setConfirmingDelete(false);
            setShowReserveInput(false);
            setReservationName(selectedCodeObj.reservedFor || '');
        }
    }, [selectedCodeObj]);

    const loadCodes = async () => {
        setIsLoading(true);
        try {
            const data = await getInvitationCodes();
            setCodes(data);
        } catch (error) {
            console.error(error);
            showToast("Failed to load codes.", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadCodes();
    }, []);

    const handleCreateCode = async () => {
        if (!user) return;
        setIsCreating(true);
        try {
            if (bulkAmount > 1) {
                await createBulkInvitationCodes(user.id, bulkAmount);
            } else {
                await createInvitationCode(user.id);
            }
            await loadCodes();
            setBulkAmount(1); // Reset
            showToast(`${bulkAmount} code(s) created successfully.`, 'success');
        } catch (error) {
            console.error(error);
            showToast("Failed to create code.", 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteClick = () => {
        setConfirmingDelete(true);
    };

    const executeDelete = async () => {
        if (!selectedCodeObj) return;

        setIsDeleting(true);
        try {
            await deleteInvitationCode(selectedCodeObj.code);
            showToast(`Code ${selectedCodeObj.code} deleted permanently.`, 'success');
            setSelectedCodeObj(null);
            await loadCodes();
        } catch (error) {
            console.error(error);
            showToast("Failed to delete code.", 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCopyCode = () => {
        if (!selectedCodeObj) return;
        navigator.clipboard.writeText(selectedCodeObj.code);
        showToast(`Copied ${selectedCodeObj.code}`, 'success');
    };

    const handleReserve = async () => {
        if (!selectedCodeObj || !reservationName.trim()) return;
        
        setIsReserving(true);
        try {
            await reserveInvitationCode(selectedCodeObj.code, reservationName.trim());
            showToast("Code reserved successfully.", 'success');
            setSelectedCodeObj(null);
            await loadCodes();
        } catch (error) {
            console.error(error);
            showToast("Failed to reserve code.", 'error');
        } finally {
            setIsReserving(false);
        }
    };

    const handleClearReservation = () => {
        if (!selectedCodeObj) return;
        setShowClearConfirm(true);
    };

    const confirmClearReservation = async () => {
        if (!selectedCodeObj) return;
        setShowClearConfirm(false);

        setIsReserving(true);
        try {
            await clearReservation(selectedCodeObj.code);
            showToast("Reservation cleared.", 'success');
            setSelectedCodeObj(null);
            await loadCodes();
        } catch (error) {
            console.error(error);
            showToast("Failed to clear reservation.", 'error');
        } finally {
            setIsReserving(false);
        }
    };

    const stats = useMemo(() => {
        const used = codes.filter(c => c.status === 'used').length;
        const reserved = codes.filter(c => c.status === 'active' && c.reservedFor).length;
        const active = codes.filter(c => c.status === 'active' && !c.reservedFor).length;
        return { used, reserved, active };
    }, [codes]);

    const filteredCodes = useMemo(() => {
        const filtered = codes.filter(code => {
            if (filter === 'all') return true;
            // "Reserved" is a real state the table has always shown but the filter never
            // offered, so reserved codes used to hide inside "active".
            if (filter === 'available') return code.status === 'active' && !code.reservedFor;
            if (filter === 'reserved') return code.status === 'active' && !!code.reservedFor;
            if (filter === 'used') return code.status === 'used';
            return true;
        });

        // Sort by created date descending (Newest first)
        return filtered.sort((a, b) => {
            const getTime = (ts: any) => {
                if (!ts) return 0;
                if (typeof ts.toMillis === 'function') return ts.toMillis();
                const d = new Date(ts);
                const time = d.getTime();
                return isNaN(time) ? 0 : time;
            };
            return getTime(b.createdAt) - getTime(a.createdAt);
        });
    }, [codes, filter]);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US');
    };

    const formatDateTimeEST = (timestamp: any) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const columns: Column<InvitationCode>[] = [
        {
            key: 'code',
            header: 'Code',
            render: code => (
                <div className="min-w-0">
                    <span className={`block font-bold tracking-widest text-pure-white ${NUMERIC}`}>
                        {code.code}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-highlight-silver md:hidden">
                        {formatDate(code.createdAt)}
                    </span>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            align: 'center',
            render: code => {
                const reserved = code.status === 'active' && !!code.reservedFor;
                return (
                    <Chip
                        label={reserved ? 'Reserved' : code.status === 'used' ? 'Used' : 'Available'}
                        tone={reserved ? 'warning' : code.status === 'used' ? 'neutral' : 'success'}
                        size="xs"
                    />
                );
            },
        },
        {
            key: 'created',
            header: 'Created',
            align: 'center',
            hideOnMobile: true,
            render: code => (
                <span className={`text-highlight-silver ${NUMERIC}`}>{formatDate(code.createdAt)}</span>
            ),
        },
        {
            key: 'who',
            header: 'Who has it',
            render: code =>
                code.usedByEmail ? (
                    <div className="min-w-0">
                        <span className="block truncate text-xs font-bold text-pure-white">
                            {code.usedByEmail}
                        </span>
                        <span className="block text-[10px] text-highlight-silver">
                            Joined {formatDateTimeEST(code.usedAt)}
                        </span>
                    </div>
                ) : code.reservedFor ? (
                    <div className="min-w-0">
                        <span className="block truncate text-xs font-bold text-amber-400">
                            {code.reservedFor}
                        </span>
                        <span className="block text-[10px] text-highlight-silver">Held for them</span>
                    </div>
                ) : (
                    <span className="text-xs text-highlight-silver opacity-40">Nobody yet</span>
                ),
        },
    ];

    return (
        <div className="max-w-7xl mx-auto text-pure-white h-full flex flex-col">
            <AdminToolShell
                title="INVITE CODES"
                icon={TicketIcon}
                subtitle="Create codes for new members and see who has used them"
                setAdminSubPage={setAdminSubPage}
                actions={
                    <div className="flex items-center gap-2">
                        <select
                            value={bulkAmount}
                            onChange={e => setBulkAmount(Number(e.target.value))}
                            className="cursor-pointer rounded-lg border border-pure-white/15 bg-carbon-black px-3 py-2 text-xs text-pure-white focus:border-primary-red focus:outline-none"
                        >
                            <option value={1}>1 code</option>
                            <option value={5}>5 codes</option>
                            <option value={10}>10 codes</option>
                        </select>
                        <button
                            onClick={handleCreateCode}
                            disabled={isCreating}
                            className="rounded-lg bg-primary-red px-4 py-2 text-[11px] font-black uppercase tracking-wider text-pure-white transition-colors hover:bg-red-600 disabled:opacity-50"
                        >
                            {isCreating ? 'Creating\u2026' : 'Create'}
                        </button>
                    </div>
                }
            />

            <div className="flex flex-1 flex-col min-h-0 px-2 md:px-0 pb-8">
                <div className="mb-4 grid grid-cols-3 gap-3">
                    <StatTile label="Available" value={stats.active} unit="codes" />
                    <StatTile label="Reserved" value={stats.reserved} unit="held" />
                    <StatTile label="Used" value={stats.used} unit="joined" />
                </div>

                <div className="mb-3">
                    <SegmentedControl
                        segments={FILTERS}
                        value={filter}
                        onChange={v => setFilter(v)}
                        size="sm"
                        scrollable
                    />
                </div>

                {isLoading ? (
                    <div className="flex-1"><ListSkeleton /></div>
                ) : (
                    <DataTable
                        columns={columns}
                        rows={filteredCodes}
                        rowKey={code => code.code}
                        onRowClick={code => setSelectedCodeObj(code)}
                        scrollInside
                        emptyTitle="No codes here"
                        emptyDescription="Try a different filter, or create some codes."
                    />
                )}
            </div>

            <Modal
                isOpen={!!selectedCodeObj && !confirmingDelete}
                onClose={() => setSelectedCodeObj(null)}
                title="Invitation code"
                icon={TicketIcon}
                size="sm"
                footer={
                    <button
                        onClick={() => setSelectedCodeObj(null)}
                        className="rounded-lg border border-pure-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-highlight-silver transition-colors hover:text-pure-white"
                    >
                        Close
                    </button>
                }
            >
                {selectedCodeObj && (
                    <>
                        <p className={`select-all break-all rounded-lg border border-pure-white/10 bg-carbon-black p-4 text-center text-2xl font-black tracking-wider text-pure-white ${NUMERIC}`}>
                            {selectedCodeObj.code}
                        </p>

                        {selectedCodeObj.usedByEmail && (
                            <p className="mt-3 text-center text-xs text-highlight-silver">
                                Already used by{' '}
                                <strong className="text-pure-white">{selectedCodeObj.usedByEmail}</strong>.
                            </p>
                        )}

                        {selectedCodeObj.reservedFor && !showReserveInput && (
                            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                                    Being held for
                                </p>
                                <p className="font-bold text-pure-white">{selectedCodeObj.reservedFor}</p>
                                <button
                                    onClick={handleClearReservation}
                                    disabled={isReserving}
                                    className="mt-2 text-[11px] font-bold text-highlight-silver underline transition-colors hover:text-pure-white"
                                >
                                    Stop holding it
                                </button>
                            </div>
                        )}

                        {showReserveInput ? (
                            <div className="mt-4 space-y-3">
                                <div>
                                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">
                                        Who are you holding it for?
                                    </label>
                                    <input
                                        type="text"
                                        value={reservationName}
                                        onChange={e => setReservationName(e.target.value)}
                                        placeholder="e.g. Alice Smith"
                                        autoFocus
                                        className="w-full rounded-lg border border-pure-white/15 bg-carbon-black p-2 text-sm text-pure-white focus:border-primary-red focus:outline-none"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowReserveInput(false)}
                                        disabled={isReserving}
                                        className="flex-1 rounded-lg border border-pure-white/15 py-2 text-xs font-bold uppercase tracking-wider text-highlight-silver hover:text-pure-white"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleReserve}
                                        disabled={isReserving || !reservationName.trim()}
                                        className="flex-1 rounded-lg bg-primary-red py-2 text-xs font-bold uppercase tracking-wider text-pure-white transition-colors hover:bg-red-600 disabled:opacity-40"
                                    >
                                        {isReserving ? 'Saving\u2026' : 'Hold it'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-4 flex flex-col gap-2">
                                <button
                                    onClick={handleCopyCode}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-pure-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-carbon-black transition-opacity hover:opacity-90"
                                >
                                    <CopyIcon className="w-4 h-4" /> Copy code
                                </button>

                                {selectedCodeObj.status === 'active' && !selectedCodeObj.reservedFor && (
                                    <button
                                        onClick={() => setShowReserveInput(true)}
                                        className="w-full rounded-lg border border-pure-white/15 bg-pure-white/5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-pure-white transition-colors hover:bg-pure-white/10"
                                    >
                                        Hold for someone
                                    </button>
                                )}

                                <button
                                    onClick={handleDeleteClick}
                                    disabled={isDeleting}
                                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-primary-red/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-red transition-colors hover:bg-primary-red hover:text-pure-white"
                                >
                                    <TrashIcon className="w-4 h-4" /> Delete this code
                                </button>
                            </div>
                        )}
                    </>
                )}
            </Modal>

            {/*
              One confirmation, not the two nested layers this used to take — deleting a
              single unused code is far less consequential than pausing the league, which
              until this gate took none at all.
            */}
            <ConfirmModal
                isOpen={confirmingDelete}
                onClose={() => setConfirmingDelete(false)}
                onConfirm={executeDelete}
                title="Delete this code"
                consequence={
                    <>
                        Code <strong className="text-pure-white">{selectedCodeObj?.code}</strong> is
                        removed for good. If you have already given it to someone, they will not be
                        able to join with it.
                    </>
                }
                confirmLabel="Delete code"
                busy={isDeleting}
                busyLabel="Deleting\u2026"
            />

            <ConfirmModal
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                onConfirm={confirmClearReservation}
                title="Stop holding this code"
                tone="warning"
                consequence={
                    <>
                        The code stops being held for{' '}
                        <strong className="text-pure-white">{selectedCodeObj?.reservedFor}</strong> and
                        goes back to available, so anyone you give it to can use it.
                    </>
                }
                confirmLabel="Stop holding it"
                busy={isReserving}
            />
        </div>
    );
};

export default AdminInvitationPage;
