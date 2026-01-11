
import React, { useState, useEffect, useMemo } from 'react';
import { User, InvitationCode } from '../types.ts';
import { getInvitationCodes, createInvitationCode, createBulkInvitationCodes, deleteInvitationCode } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { TicketIcon } from './icons/TicketIcon.tsx';
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
    
    // Deletion State
    const [selectedCodeForDelete, setSelectedCodeForDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { showToast } = useToast();

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

    const handleDeleteCode = async () => {
        if (!selectedCodeForDelete) return;
        setIsDeleting(true);
        try {
            await deleteInvitationCode(selectedCodeForDelete);
            showToast(`Code ${selectedCodeForDelete} deleted permanently.`, 'success');
            setSelectedCodeForDelete(null);
            await loadCodes();
        } catch (error) {
            console.error(error);
            showToast("Failed to delete code.", 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredCodes = useMemo(() => {
        return codes.filter(code => {
            if (filter === 'all') return true;
            if (filter === 'active') return code.status === 'active';
            if (filter === 'used') return code.status === 'used';
            return true;
        });
    }, [codes, filter]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-600/80 text-pure-white shadow-[0_0_10px_rgba(34,197,94,0.3)]';
            case 'reserved': return 'bg-yellow-500/80 text-carbon-black';
            case 'used': return 'bg-carbon-black text-highlight-silver border border-pure-white/20';
            default: return 'bg-carbon-black';
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString();
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

            <div className="flex-1 flex flex-col min-h-0 px-4 md:px-0 pb-8">
                {/* Controls - Fixed Height */}
                <div className="bg-carbon-fiber backdrop-blur-sm rounded-lg p-4 border border-pure-white/10 mb-6 flex flex-col md:flex-row gap-6 justify-between items-center px-4 md:px-0 shadow-lg flex-none">
                    <div className="flex bg-carbon-black rounded-lg p-1 border border-pure-white/10">
                        {(['all', 'active', 'used'] as const).map(f => (
                            <button 
                                key={f} 
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-md text-sm font-bold capitalize transition-colors ${filter === f ? 'bg-primary-red text-pure-white shadow-md' : 'text-highlight-silver hover:text-pure-white'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 bg-carbon-black/50 p-2 rounded-lg border border-pure-white/10">
                        <span className="text-xs text-highlight-silver font-bold uppercase mr-2">Create</span>
                        <select 
                            value={bulkAmount} 
                            onChange={(e) => setBulkAmount(Number(e.target.value))}
                            className="bg-carbon-black border border-accent-gray text-pure-white text-sm rounded px-2 py-1 focus:ring-1 focus:ring-primary-red outline-none"
                        >
                            <option value={1}>1 Code</option>
                            <option value={5}>5 Codes</option>
                            <option value={10}>10 Codes</option>
                        </select>
                        <button 
                            onClick={handleCreateCode}
                            disabled={isCreating}
                            className="bg-primary-red hover:opacity-90 text-pure-white font-bold py-1.5 px-4 rounded text-sm disabled:opacity-50 transition-all shadow-lg shadow-primary-red/20"
                        >
                            {isCreating ? 'Generating...' : 'Generate'}
                        </button>
                    </div>
                </div>

                {/* List Container - Takes Remaining Space */}
                {isLoading ? <div className="flex-1"><ListSkeleton /></div> : (
                    <div className="bg-carbon-fiber backdrop-blur-sm rounded-lg border border-pure-white/10 shadow-xl flex flex-col flex-1 min-h-0 overflow-hidden">
                        <div className="overflow-y-auto custom-scrollbar flex-1">
                            <table className="w-full text-left">
                                <thead className="bg-carbon-black/90 sticky top-0 z-10 backdrop-blur-md border-b border-pure-white/10">
                                    <tr>
                                        <th className="p-4 text-xs font-bold uppercase text-highlight-silver">Code</th>
                                        <th className="p-4 text-xs font-bold uppercase text-highlight-silver text-center">Status</th>
                                        <th className="p-4 text-xs font-bold uppercase text-highlight-silver hidden md:table-cell">Created</th>
                                        <th className="p-4 text-xs font-bold uppercase text-highlight-silver hidden md:table-cell">Used By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCodes.map(code => (
                                        <tr 
                                            key={code.code} 
                                            className="border-t border-pure-white/5 hover:bg-pure-white/5 transition-colors cursor-pointer group"
                                            onClick={() => setSelectedCodeForDelete(code.code)}
                                        >
                                            <td className="p-4 font-mono font-bold text-pure-white tracking-wider group-hover:text-primary-red transition-colors">{code.code}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 text-xs font-bold uppercase rounded-full ${getStatusColor(code.status)}`}>
                                                    {code.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-highlight-silver hidden md:table-cell">{formatDate(code.createdAt)}</td>
                                            <td className="p-4 hidden md:table-cell">
                                                {code.usedByEmail ? (
                                                    <div className="text-xs">
                                                        <span className="text-pure-white block font-semibold">{code.usedByEmail}</span>
                                                        <span className="text-highlight-silver block opacity-70">{formatDate(code.usedAt)}</span>
                                                    </div>
                                                ) : <span className="text-highlight-silver text-xs opacity-50">-</span>}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredCodes.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-highlight-silver italic bg-carbon-black/20">No codes found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {selectedCodeForDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon-black/90 backdrop-blur-md p-4 animate-fade-in" onClick={() => !isDeleting && setSelectedCodeForDelete(null)}>
                    <div className="bg-accent-gray border border-primary-red/50 rounded-xl p-8 max-w-sm w-full text-center shadow-[0_0_50px_rgba(218,41,28,0.3)] ring-1 ring-pure-white/10 animate-peek-up" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 bg-primary-red/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <TicketIcon className="w-8 h-8 text-primary-red" />
                        </div>
                        
                        <h2 className="text-2xl font-bold text-pure-white mb-2">Delete Code?</h2>
                        <p className="text-highlight-silver mb-8 text-sm leading-relaxed">
                            Are you sure you want to permanently delete invitation code <span className="text-pure-white font-mono font-bold">{selectedCodeForDelete}</span>?
                            This action cannot be undone.
                        </p>
                        
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleDeleteCode}
                                disabled={isDeleting}
                                className="w-full bg-primary-red hover:bg-red-600 text-pure-white font-black py-3 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-primary-red/20 uppercase tracking-widest text-xs"
                            >
                                {isDeleting ? 'Deleting...' : 'Confirm Permanent Deletion'}
                            </button>
                            <button
                                onClick={() => setSelectedCodeForDelete(null)}
                                disabled={isDeleting}
                                className="w-full bg-transparent hover:bg-pure-white/5 text-highlight-silver font-bold py-3 px-6 rounded-lg transition-colors border border-transparent hover:border-pure-white/10 text-xs uppercase"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminInvitationPage;
