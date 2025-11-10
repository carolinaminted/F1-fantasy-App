import React from 'react';
import { Donation, User } from '../types.ts';

interface DonationPreviewModalProps {
    donation: Donation;
    user: User;
    onClose: () => void;
}

const DonationPreviewModal: React.FC<DonationPreviewModalProps> = ({ donation, user, onClose }) => {
    
    const formatDate = (timestamp: { seconds: number }) => {
        return new Date(timestamp.seconds * 1000).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const DetailRow: React.FC<{ label: string; value: string | React.ReactNode }> = ({ label, value }) => (
        <div className="flex justify-between items-start py-2 border-b border-accent-gray/50">
            <span className="text-highlight-silver">{label}</span>
            <span className="font-semibold text-pure-white text-right">{value}</span>
        </div>
    );

    return (
        <div 
            className="fixed inset-0 bg-carbon-black/80 flex items-center justify-center z-50 p-4" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="donation-preview-title"
        >
            <div 
                className="bg-accent-gray rounded-lg max-w-md w-full ring-1 ring-pure-white/20 shadow-2xl" 
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <h3 id="donation-preview-title" className="text-2xl font-bold text-pure-white">Donation Details</h3>
                        <button 
                            onClick={onClose} 
                            className="text-highlight-silver hover:text-pure-white text-3xl leading-none"
                            aria-label="Close modal"
                        >
                            &times;
                        </button>
                    </div>
                    <div className="space-y-2 text-sm">
                        <DetailRow label="Date" value={formatDate(donation.createdAt)} />
                        <DetailRow label="Name" value={user.displayName} />
                        <DetailRow label="Amount" value={`$${(donation.amount / 100).toFixed(2)} ${donation.currency}`} />
                        <DetailRow 
                            label="Method" 
                            value={`${donation.methodType.charAt(0).toUpperCase() + donation.methodType.slice(1)} ${donation.cardLast4 ? `ending in ${donation.cardLast4}` : ''}`} 
                        />
                        <DetailRow label="Status" value={
                            <span className="px-2 py-0.5 text-xs font-bold uppercase rounded-full bg-green-600/80 text-pure-white">
                                {donation.status}
                            </span>
                        } />
                        <DetailRow label="Donation ID" value={<span className="font-mono text-xs">{donation.id}</span>} />
                        <DetailRow label="Provider Ref." value={<span className="font-mono text-xs">{donation.providerTxnId}</span>} />
                    </div>
                     <div className="mt-6 text-right">
                        <button
                            onClick={onClose}
                            className="bg-primary-red hover:opacity-90 text-pure-white font-bold py-2 px-6 rounded-lg"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DonationPreviewModal;