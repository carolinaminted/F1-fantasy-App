
import React, { useState, useEffect, useMemo } from 'react';
import { User, InvitationCode } from '../types.ts';
import { getInvitationCodes, createInvitationCode, createBulkInvitationCodes, deleteInvitationCode, reserveInvitationCode, clearReservation } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { TicketIcon } from './icons/TicketIcon.tsx';
import { CopyIcon } from './icons/CopyIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { ListSkeleton } from './LoadingSkeleton.tsx';
import { useToast } from '../contexts/ToastContext.tsx';

interface AdminInvitationPageProps {
    setAdminSubPage: (page: 'dashboard' | 'results' | 'manage-users' | 'scoring' | 'entities' | 'schedule' | 'invitations') => void;
    user: User | null;
}

const AdminInvitationPage: React.FC<AdminInvitationPageProps> = ({ setAdminSubPage, user }) => {
    const [codes, setCodes] = useState<InvitationCode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'used'>('active');
    const [isCreating, setIsCreating] = useState(false);
    const [bulkAmount, setBulkAmount] = useState(1);
    
    // Selection State
    const [selectedCodeObj, setSelectedCodeObj] = useState<InvitationCode | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    
    // Reservation State
    const [isReserving, setIsReserving] = useState(false);
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
        showToast("Code copied to clipboard!", 'success');
        setSelectedCodeObj(null);
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

    const handleClearReservation = async () => {
        if (!selectedCodeObj) return;
        if (!confirm("Are you sure you want to clear this reservation?")) return;

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

    const filteredCodes = useMemo(() => {
        const filtered = codes.filter(code => {
            if (filter === 'all') return true;
            if (filter === 'active') return code.status === 'active';
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

    const getStatusColor = (code: InvitationCode) => {
        if (code.status === 'active' && code.reservedFor) {
            return 'bg-blue-600 text-pure-white shadow-[0_0_10px_rgba(37,99,235,0.4)]';
        }
        switch (code.status) {
            case 'active': return 'bg-green-500 text-carbon-black shadow-[0_0_10px_rgba(34,197,94,0.4)]';
            case 'reserved': return 'bg-yellow-500 text-carbon-black';
            case 'used': return 'bg-carbon-black text-highlight-silver border border-pure-white/20';
            default: return 'bg-carbon-black';
        }
    };

    const getStatusLabel = (code: InvitationCode) => {
        if (code.status === 'active' && code.reservedFor) {
            return 'RESERVED';
        }
        return code.status.toUpperCase();
    }

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

    const DashboardAction = (
        <button 
            onClick={() => setAdminSubPage('dashboard')}
            className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10 hover:border-pure-white/30"
        >
            <BackIcon className="w-4 h-4" /> 
            <span className="text-sm font-bold">Dashboard</span>
        </button>
    );

    return (
        <div className="max-w-7xl mx-auto text-pure-white h-full flex flex-col">
            <div className="flex-none">
                <PageHeader 
                    title="INVITATION MANAGER" 
                    icon={TicketIcon} 
                    leftAction={DashboardAction}
                />
            </div>

            <div className="flex-1 flex flex-col min-h-0 px-2 md:px-0 pb-8">
                {/* Controls - Fixed Height */}
                <div className="bg-carbon-fiber/50 backdrop-blur-sm rounded-lg p-4 border border-pure-white/10 mb-6 flex flex-col md:flex-row gap-6 justify-between items-center shadow-lg flex-none ring-1 ring-pure-white/5">
                    <div className="flex bg-carbon-black rounded-lg p-1 border border-pure-white/10">
                        {(['all', 'active', 'used'] as const).map(f => (
                            <button 
                                key={f} 
                                onClick={() => setFilter(f)}
                                className={`px-5 py-2 rounded-md text-sm font-bold uppercase transition-all ${filter === f ? 'bg-primary-red text-pure-white shadow-lg' : 'text-highlight-silver hover:text-pure-white hover:bg-white/5'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 bg-carbon-black/50 p-2 rounded-lg border border-pure-white/10">
                        <span className="text-[10px] text-highlight-silver font-black uppercase tracking-widest mr-2 ml-1">Create</span>
                        <select 
                            value={bulkAmount} 
                            onChange={(e) => setBulkAmount(Number(e.target.value))}
                            className="bg-carbon-black border border-accent-gray text-pure-white text-sm rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-primary-red outline-none appearance-none cursor-pointer"
                        >
                            <option value={1}>1 Code</option>
                            <option value={5}>5 Codes</option>
                            <option value={10}>10 Codes</option>
                        </select>
                        <button 
                            onClick={handleCreateCode}
                            disabled={isCreating}
                            className="bg-primary-red hover:bg-red-600 text-pure-white font-black py-2 px-6 rounded-lg text-xs uppercase tracking-widest disabled:opacity-50 transition-all shadow-lg shadow-primary-red/20 active:scale-95"
                        >
                            {isCreating ? 'Generating...' : 'Generate'}
                        </button>
                    </div>
                </div>

                {/* List Container - Takes Remaining Space */}
                {isLoading ? <div className="flex-1"><ListSkeleton /></div> : (
                    <div className="bg-carbon-fiber rounded-xl border border-pure-white/10 shadow-2xl flex flex-col flex-1 min-h-0 overflow-hidden ring-1 ring-pure-white/5">
                        <div className="overflow-y-auto custom-scrollbar flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-carbon-black/80 sticky top-0 z-10 backdrop-blur-md border-b border-pure-white/10">
                                    <tr>
                                        <th className="p-4 text-[10px] font-black uppercase text-highlight-silver tracking-widest hidden md:table-cell">Code</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-highlight-silver tracking-widest text-center">Status</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-highlight-silver tracking-widest text-center hidden md:table-cell">Created</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-highlight-silver tracking-widest text-left md:text-center">Used By / Reserved</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-pure-white/5">
                                    {filteredCodes.map(code => (
                                        <tr 
                                            key={code.code} 
                                            className="hover:bg-pure-white/5 transition-colors cursor-pointer group"
                                            onClick={() => setSelectedCodeObj(code)}
                                        >
                                            <td className="p-4 font-mono font-bold text-pure-white tracking-widest group-hover:text-primary-red transition-colors min-w-[200px] hidden md:table-cell">{code.code}</td>
                                            <td className="p-4 text-center">
                                                <span className={`inline-block px-3 py-1 text-[10px] font-black uppercase rounded-lg ${getStatusColor(code)}`}>
                                                    {getStatusLabel(code)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-highlight-silver font-medium text-center hidden md:table-cell">{formatDate(code.createdAt)}</td>
                                            <td className="p-4 text-left md:text-center">
                                                {code.usedByEmail ? (
                                                    <div className="inline-flex flex-col items-start md:items-center">
                                                        <span className="text-pure-white block font-bold text-xs truncate max-w-[150px] md:max-w-none">{code.usedByEmail}</span>
                                                        <span className="text-[10px] text-highlight-silver block opacity-50 uppercase tracking-tighter">{formatDateTimeEST(code.usedAt)}</span>
                                                    </div>
                                                ) : code.reservedFor ? (
                                                    <div className="inline-flex flex-col items-start md:items-center">
                                                        <span className="text-blue-400 block font-bold text-xs">{code.reservedFor}</span>
                                                        <span className="text-[10px] text-highlight-silver block opacity-50 uppercase tracking-tighter">Manually Reserved</span>
                                                    </div>
                                                ) : <span className="text-highlight-silver text-xs opacity-30 font-bold">-</span>}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredCodes.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-12 text-center text-highlight-silver italic bg-carbon-black/20 opacity-50 font-bold uppercase tracking-widest">No matching codes found in database.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Code Detail Modal */}
            {selectedCodeObj && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon-black/90 backdrop-blur-md p-4 animate-fade-in" onClick={() => !isDeleting && setSelectedCodeObj(null)}>
                    <div className="bg-carbon-fiber border border-pure-white/10 rounded-xl p-8 max-w-sm w-full text-center shadow-2xl ring-1 ring-pure-white/10 animate-scale-in" onClick={e => e.stopPropagation()}>
                        
                        <div className="w-16 h-16 bg-pure-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-pure-white/10">
                            <TicketIcon className="w-8 h-8 text-pure-white" />
                        </div>
                        
                        <h2 className="text-xs font-bold text-highlight-silver uppercase tracking-widest mb-2">Invitation Code</h2>
                        <p className="text-2xl md:text-3xl font-black text-pure-white mb-4 font-mono tracking-wider break-all leading-none bg-black/20 p-4 rounded-lg border border-pure-white/5 select-all">
                            {selectedCodeObj.code}
                        </p>

                        {/* Reservation Info */}
                        {selectedCodeObj.reservedFor && !showReserveInput && (
                            <div className="mb-6 bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg">
                                <p className="text-xs text-blue-400 font-bold uppercase tracking-wide mb-1">Reserved For</p>
                                <p className="text-pure-white font-bold">{selectedCodeObj.reservedFor}</p>
                                <button 
                                    onClick={handleClearReservation}
                                    disabled={isReserving}
                                    className="text-[10px] text-red-400 hover:text-red-300 underline mt-2"
                                >
                                    Clear Reservation
                                </button>
                            </div>
                        )}
                        
                        <div className="flex flex-col gap-3">
                            {showReserveInput ? (
                                <div className="space-y-3 animate-fade-in">
                                    <div className="text-left">
                                        <label className="text-[10px] font-bold text-highlight-silver uppercase tracking-wider block mb-1">Reserve For (Name or Email)</label>
                                        <input 
                                            type="text" 
                                            value={reservationName} 
                                            onChange={(e) => setReservationName(e.target.value)}
                                            className="w-full bg-carbon-black border border-accent-gray rounded p-2 text-pure-white text-sm focus:border-blue-500 outline-none"
                                            placeholder="e.g. Alice Smith"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowReserveInput(false)}
                                            disabled={isReserving}
                                            className="flex-1 bg-transparent border border-highlight-silver text-highlight-silver font-bold py-2 rounded-lg text-xs uppercase hover:text-pure-white"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleReserve}
                                            disabled={isReserving || !reservationName.trim()}
                                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-pure-white font-bold py-2 rounded-lg text-xs uppercase"
                                        >
                                            {isReserving ? 'Saving...' : 'Confirm'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                !confirmingDelete && (
                                    <>
                                        <button
                                            onClick={handleCopyCode}
                                            className="w-full bg-pure-white hover:bg-highlight-silver text-carbon-black font-black py-3 px-6 rounded-lg transition-all transform hover:scale-105 shadow-[0_0_15px_rgba(255,255,255,0.2)] uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                                        >
                                            <CopyIcon className="w-4 h-4" /> Copy Code
                                        </button>

                                        {selectedCodeObj.status === 'active' && !selectedCodeObj.reservedFor && (
                                            <button
                                                onClick={() => setShowReserveInput(true)}
                                                className="w-full bg-blue-600 hover:bg-blue-500 text-pure-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg shadow-blue-600/20 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                                            >
                                                Reserve for User
                                            </button>
                                        )}
                                    </>
                                )
                            )}
                            
                            <div className="h-px bg-pure-white/10 w-full my-2"></div>

                            {confirmingDelete ? (
                                <div className="bg-red-900/20 p-4 rounded-lg border border-red-500/30 animate-fade-in">
                                    <p className="text-sm font-bold text-red-400 mb-3">Are you sure? This is permanent.</p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setConfirmingDelete(false)}
                                            disabled={isDeleting}
                                            className="w-full bg-transparent hover:bg-pure-white/10 text-highlight-silver font-bold py-2 px-4 rounded-lg text-xs uppercase"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={executeDelete}
                                            disabled={isDeleting}
                                            className="w-full bg-red-600 hover:bg-red-500 text-pure-white font-bold py-2 px-4 rounded-lg text-xs uppercase transition-colors flex items-center justify-center gap-2"
                                        >
                                            {isDeleting ? 'Deleting...' : <><TrashIcon className="w-4 h-4" /> Confirm</>}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {!showReserveInput && (
                                        <button
                                            onClick={handleDeleteClick}
                                            disabled={isDeleting}
                                            className="w-full bg-red-900/10 hover:bg-red-900/30 text-red-500 font-bold py-3 px-6 rounded-lg transition-colors border border-red-500/20 hover:border-red-500/40 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                                        >
                                            <TrashIcon className="w-4 h-4" /> Delete Permanently
                                        </button>
                                    )}
                                    
                                    <button
                                        onClick={() => setSelectedCodeObj(null)}
                                        disabled={isDeleting}
                                        className="w-full bg-transparent hover:bg-pure-white/5 text-highlight-silver font-bold py-2 px-6 rounded-lg transition-colors text-xs uppercase"
                                    >
                                        Close
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminInvitationPage;
