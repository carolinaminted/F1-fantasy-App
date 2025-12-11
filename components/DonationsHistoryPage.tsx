
import React, { useState, useEffect } from 'react';
import { User, Donation } from '../types.ts';
import { getUserDonations } from '../services/firestoreService.ts';
import { HistoryIcon } from './icons/HistoryIcon.tsx';
import DonationPreviewModal from './DonationPreviewModal.tsx';

interface DonationsHistoryPageProps {
    user: User | null;
}

const DonationsHistoryPage: React.FC<DonationsHistoryPageProps> = ({ user }) => {
    const [donations, setDonations] = useState<Donation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);

    useEffect(() => {
        if (user) {
            const fetchDonations = async () => {
                setIsLoading(true);
                const userDonations = await getUserDonations(user.id);
                setDonations(userDonations);
                setIsLoading(false);
            };
            fetchDonations();
        } else {
            setIsLoading(false);
        }
    }, [user]);

    if (isLoading) {
        return <div className="text-center text-highlight-silver">Loading donation history...</div>;
    }

    if (!user) {
        return <div className="text-center text-primary-red">Please log in to view your donation history.</div>;
    }

    if (donations.length === 0) {
        return (
            <div className="text-center bg-accent-gray/50 p-8 rounded-lg">
                <HistoryIcon className="w-16 h-16 mx-auto text-highlight-silver mb-4" />
                <h2 className="text-2xl font-bold text-pure-white">No Donations Yet</h2>
                <p className="text-highlight-silver mt-2">Your contribution history will appear here.</p>
            </div>
        );
    }
    
    const formatDate = (timestamp: { seconds: number }) => {
        return new Date(timestamp.seconds * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const DonationCard: React.FC<{ donation: Donation }> = ({ donation }) => (
        <div 
            onClick={() => setSelectedDonation(donation)}
            className="bg-accent-gray/50 rounded-lg p-4 mb-3 border border-pure-white/5 active:bg-pure-white/10"
        >
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="font-bold text-pure-white text-lg">${(donation.amount / 100).toFixed(2)}</h3>
                    <p className="text-highlight-silver text-sm">{formatDate(donation.createdAt)}</p>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-green-600/80 text-pure-white">
                    {donation.status}
                </span>
            </div>
             <div className="flex justify-between items-center text-xs text-highlight-silver mt-2">
                 <span>{donation.methodType}</span>
                 {donation.providerTxnId && <span className="font-mono opacity-50">#{donation.providerTxnId.slice(-6)}</span>}
             </div>
        </div>
    );

    return (
        <>
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl md:text-4xl font-bold text-pure-white mb-8 text-center">Donation History</h1>
                
                {/* Mobile View */}
                <div className="md:hidden">
                    {donations.map(donation => <DonationCard key={donation.id} donation={donation} />)}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block bg-accent-gray/50 backdrop-blur-sm rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-carbon-black/50">
                                <tr>
                                    <th className="p-4 text-sm font-semibold uppercase text-highlight-silver">Date</th>
                                    <th className="p-4 text-sm font-semibold uppercase text-highlight-silver text-right">Amount</th>
                                    <th className="p-4 text-sm font-semibold uppercase text-highlight-silver hidden md:table-cell">Method</th>
                                    <th className="p-4 text-sm font-semibold uppercase text-highlight-silver hidden sm:table-cell">Transaction ID</th>
                                    <th className="p-4 text-sm font-semibold uppercase text-highlight-silver text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {donations.map(donation => (
                                    <tr 
                                        key={donation.id} 
                                        className="border-t border-accent-gray/50 hover:bg-accent-gray/70 cursor-pointer"
                                        onClick={() => setSelectedDonation(donation)}
                                    >
                                        <td className="p-4 font-semibold whitespace-nowrap">{formatDate(donation.createdAt)}</td>
                                        <td className="p-4 font-bold text-lg text-right whitespace-nowrap">${(donation.amount / 100).toFixed(2)}</td>
                                        <td className="p-4 text-highlight-silver hidden md:table-cell capitalize">
                                            {donation.methodType} {donation.cardLast4 ? `•••• ${donation.cardLast4}`: ''}
                                        </td>
                                        <td className="p-4 text-highlight-silver font-mono text-xs hidden sm:table-cell truncate max-w-xs">{donation.providerTxnId}</td>
                                        <td className="p-4 text-center">
                                            <span className="px-3 py-1 text-xs font-bold uppercase rounded-full bg-green-600/80 text-pure-white">
                                                {donation.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {selectedDonation && (
                <DonationPreviewModal 
                    donation={selectedDonation} 
                    user={user} 
                    onClose={() => setSelectedDonation(null)} 
                />
            )}
        </>
    );
};

export default DonationsHistoryPage;
