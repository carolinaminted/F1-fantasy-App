import React, { useState, useEffect, useCallback } from 'react';
import { User, Donation } from '../types.ts';
import { Page } from '../App.tsx';
import { HistoryIcon } from './icons/HistoryIcon.tsx';
import DonationPreviewModal from './DonationPreviewModal.tsx';
import { getUserDonations } from '../services/firestoreService.ts';

interface DonationPageProps {
  user: User | null;
  setActivePage: (page: Page) => void;
}

const DonationPage: React.FC<DonationPageProps> = ({ user, setActivePage }) => {
    // Donation History State
    const [donations, setDonations] = useState<Donation[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);

    const fetchDonations = useCallback(async () => {
        if (user) {
            setIsLoadingHistory(true);
            const userDonations = await getUserDonations(user.id);
            setDonations(userDonations);
            setIsLoadingHistory(false);
        }
    }, [user]);
    
    useEffect(() => {
        fetchDonations();
    }, [fetchDonations]);
    
     const formatDate = (timestamp: { seconds: number }) => {
        return new Date(timestamp.seconds * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };
    
    return (
        <>
        <div className="max-w-5xl mx-auto space-y-12">
            <div>
                <h1 className="text-3xl font-bold text-center mb-8">Make a Donation</h1>

                <div className="bg-accent-gray/30 backdrop-blur-sm p-6 rounded-lg ring-1 ring-pure-white/10 text-center mb-6">
                    <h2 className="text-xl font-semibold text-pure-white">Donate directly to Victory Junction</h2>
                    <a 
                        href="https://victoryjunction.org/donate-online/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-block bg-primary-red hover:opacity-90 text-pure-white font-bold py-2 px-6 rounded-lg transition-transform transform hover:scale-105"
                    >
                        Donate Now
                    </a>
                </div>

                <p className="text-center text-highlight-silver mb-8">... or ...</p>
                
                <main className="bg-accent-gray/50 backdrop-blur-sm p-6 md:p-8 rounded-lg ring-1 ring-pure-white/10 text-center">
                    <h2 className="text-xl font-semibold text-pure-white">Contribute to League Operational Costs</h2>
                    <p className="text-highlight-silver text-sm mt-2 mb-4">Your contribution helps cover hosting fees and keeps the league running smoothly for the season. Thank you for your support!</p>
                     <a 
                        href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=jhouser1988@gmail.com&item_name=F1+Fantasy+League+Operational+Costs&currency_code=USD"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-block bg-blue-600 hover:bg-blue-500 text-pure-white font-bold py-3 px-8 rounded-lg transition-transform transform hover:scale-105"
                    >
                        Donate via PayPal
                    </a>
                    <p className="text-xs text-highlight-silver/50 mt-4">
                        Note: You will be redirected to PayPal's secure website. Remember to replace the placeholder email in the code with your actual PayPal address.
                    </p>
                </main>
            </div>

            {/* Donation History Section */}
            <div>
                 <h2 className="text-2xl font-bold text-center mb-6 flex items-center justify-center gap-3">
                    <HistoryIcon className="w-7 h-7" /> Your Donation History
                </h2>
                <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
                    {isLoadingHistory ? (
                        <p className="p-8 text-center text-highlight-silver">Loading history...</p>
                    ) : donations.length === 0 ? (
                        <p className="p-8 text-center text-highlight-silver">No donations exist for this user.</p>
                    ) : (
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
                    )}
                </div>
            </div>
        </div>
        {selectedDonation && user && (
            <DonationPreviewModal 
                donation={selectedDonation} 
                user={user} 
                onClose={() => setSelectedDonation(null)} 
            />
        )}
        </>
    );
};

export default DonationPage;