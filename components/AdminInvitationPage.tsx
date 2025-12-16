
import React, { useState, useEffect, useMemo } from 'react';
import { User, InvitationCode } from '../types.ts';
import { getInvitationCodes, createInvitationCode, createBulkInvitationCodes } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { TicketIcon } from './icons/TicketIcon.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { ListSkeleton } from './LoadingSkeleton.tsx';
import { useToast } from '../contexts/ToastContext.tsx';

interface AdminInvitationPageProps {
    setAdminSubPage: (page: 'dashboard') => void;
    user: User | null;
}

const AdminInvitationPage: React.FC<AdminInvitationPageProps> = ({ setAdminSubPage, user }) => {
    const [codes, setCodes] = useState<InvitationCode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'used'>('all');
    const [isCreating, setIsCreating] = useState(false);
    const [bulkAmount, setBulkAmount] = useState(1);
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
            case 'active': return 'bg-green-600/80 text-pure-white';
            case 'reserved': return 'bg-yellow-500/80 text-carbon-black';
            case 'used': return 'bg-carbon-black text-highlight-silver border border-pure-white/20';
            default: return 'bg-carbon-black';
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '-';
        // Handle Firestore Timestamp or standard Date
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
            <PageHeader 
                title="INVITATION MANAGER" 
                icon={TicketIcon} 
                leftAction={DashboardAction}
            />

            {/* Controls */}
            <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-4 ring-1 ring-pure-white/10 mb-6 flex flex-col md:flex-row gap-6 justify-between items-center px-4 md:px-0">
                <div className="flex bg-carbon-black rounded-lg p-1">
                    {(['all', 'active', 'used'] as const).map(f => (
                        <button 
                            key={f} 
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-md text-sm font-bold capitalize transition-colors ${filter === f ? 'bg-primary-red text-pure-white' : 'text-highlight-silver hover:text-pure-white'}`}
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
                        className="bg-carbon-black border border-accent-gray text-pure-white text-sm rounded px-2 py-1"
                    >
                        <option value={1}>1 Code</option>
                        <option value={5}>5 Codes</option>
                        <option value={10}>10 Codes</option>
                    </select>
                    <button 
                        onClick={handleCreateCode}
                        disabled={isCreating}
                        className="bg-primary-red hover:opacity-90 text-pure-white font-bold py-1.5 px-4 rounded text-sm disabled:opacity-50"
                    >
                        {isCreating ? 'Generating...' : 'Generate'}
                    </button>
                </div>
            </div>

            {/* List */}
            {isLoading ? <ListSkeleton /> : (
                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-0 pb-8">
                    <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-carbon-black/50 sticky top-0 z-10 backdrop-blur-sm">
                                <tr>
                                    <th className="p-4 text-xs font-bold uppercase text-highlight-silver">Code</th>
                                    <th className="p-4 text-xs font-bold uppercase text-highlight-silver text-center">Status</th>
                                    <th className="p-4 text-xs font-bold uppercase text-highlight-silver hidden md:table-cell">Created</th>
                                    <th className="p-4 text-xs font-bold uppercase text-highlight-silver hidden md:table-cell">Used By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCodes.map(code => (
                                    <tr key={code.code} className="border-t border-accent-gray/50 hover:bg-pure-white/5">
                                        <td className="p-4 font-mono font-bold text-pure-white tracking-wider">{code.code}</td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-1 text-xs font-bold uppercase rounded-full ${getStatusColor(code.status)}`}>
                                                {code.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-highlight-silver hidden md:table-cell">{formatDate(code.createdAt)}</td>
                                        <td className="p-4 hidden md:table-cell">
                                            {code.usedByEmail ? (
                                                <div className="text-xs">
                                                    <span className="text-pure-white block">{code.usedByEmail}</span>
                                                    <span className="text-highlight-silver block">{formatDate(code.usedAt)}</span>
                                                </div>
                                            ) : <span className="text-highlight-silver text-xs">-</span>}
                                        </td>
                                    </tr>
                                ))}
                                {filteredCodes.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-highlight-silver italic">No codes found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminInvitationPage;
